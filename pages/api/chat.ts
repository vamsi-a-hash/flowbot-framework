import type { NextApiRequest, NextApiResponse } from 'next';
import { makeChain } from '@/utils/makechain';
import dbConnect from '@/config/mongodb';
import { upsertSubscription } from '@/models/subscriptionModel';
import { IUser, upsertUserByEmail } from '@/models/userModel';
import { ITokenUsage, upsertUserHistory, pushChatEntry } from '@/models/userHistoryModel';
import axios from 'axios';
import { BigQuery } from '@google-cloud/bigquery';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { GoogleAuth } from 'google-auth-library';
const parser = require('@babel/parser');
const generator = require('@babel/generator');
const fs = require('fs-extra');
const FormData = require('form-data');
const json5 = require('json5');
import path from 'path';
const { htmlToText } = require('html-to-text');

export const config = { api: { bodyParser: { sizeLimit: '100mb' } } };

import { SESSION_COOKIE } from '@/pages/api/auth/session';
import { getVerifiedEmail } from '@/utils/auth';
import appConfig from '@/config/constants';

async function botRequiresAuth(chatBotId: string): Promise<boolean> {
  const loadOpenId = async (id: string) => {
    try {
      const mod: any = await import(`@/configuration/${id}/webapp`);
      return mod?.openid;
    } catch {
      return undefined;
    }
  };
  const openid = (await loadOpenId(chatBotId)) ?? (await loadOpenId('default'));
  return !!(openid?.authorization_endpoint && openid?.client_id);
}

/**
 * Resolve the logged-in user from session cookies.
 * Returns the user doc if email is present, null for anonymous sessions.
 */
async function resolveUser(req: NextApiRequest): Promise<IUser | null> {
    try {
        const email = await getVerifiedEmail(req);
        // Name is display-only, not used for identity — no need to verify it
        const rawName = req.cookies["chatbot_user"];
        const name = rawName ? decodeURIComponent(rawName) : "";
        return upsertUserByEmail(email, name);
    } catch {
        // No valid session token — anonymous user, chat still works
        return null;
    }
}

/**
 * Persists one Q&A pair to user_histories after a successful response.
 * Non-fatal — a DB write failure must never break the chat response.
 */
async function saveChatHistory(
    sessionId: string,
    chatbotId: string,
    user: IUser | null,
    question: string,
    answer: string,
    graphIds: string[],
    tokens: ITokenUsage
): Promise<void> {
    try {
        const email  = user?.email  || null;
        const userId = user?._id    || null;

        await upsertUserHistory(sessionId, chatbotId, email, userId);
        await pushChatEntry(sessionId, {
            question,
            answer,
            graphIds: graphIds.filter(Boolean), // drop empty strings
            tokens,
        });
    } catch (err) {
        console.error('saveChatHistory failed (non-fatal):', err);
    }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const {
    question,
    history,
    enablegptfallback,
    session,
    graphIds, 
    reqQuery,
    chainStatus = false,
  } = req.body;
  const chatBotId = String(req.query.chatBotId || 'default');

  await dbConnect();

  //only accept post requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Enforce authentication for bots that have OpenID configured.
  if ((await botRequiresAuth(chatBotId)) && !req.cookies[SESSION_COOKIE]) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // OpenAI recommends replacing newlines with spaces for best results
  const sanitizedQuestion = question;
  // const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  try {
    //create chain
    const chain = new makeChain(chatBotId);
    if (chainStatus) {
      const response = await chain.run(question);
      return res.status(200).json(response);
    }

        // Single user record per person — no session-keyed user records any more.
        // Anonymous users (no email cookie) get null; the chat still works, just
        // not linked to a persistent user profile.
        const user = await resolveUser(req);

    const headers = {
      ...req.headers,
      authorization: `Bearer ${appConfig.TDB_TTT_SERVICE_AUTHORIZATION}`,
    };

        // TODO: when "New Chat" button is implemented, pass the new sessionId from
        //       the frontend so user_histories creates a fresh record for that session.
    return new Promise((resolve) => {
      import(`@/configuration/${chatBotId}/server`)
        .then(async (module) => {
          const isStreaming = Boolean(module.streaming);
          if (isStreaming) {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
            });
            res.flushHeaders();
          }

          const sendFinal = (payload: any) => {
            if (res.destroyed) return;
            res.write(`data: ${JSON.stringify({ type: 'final', payload })}\n\n`);
            res.end();
          };

          try {
            const onToken = isStreaming
              ? (chunk: string) => {
                  if (res.destroyed) throw new Error('Client disconnected');
                  res.write(`data: ${JSON.stringify({ type: 'token', chunk })}\n\n`);
                }
              : undefined;

            const response = await module.start(
              {
                chain,
                axiosInstance: axios,
                user,
                graphIds,
                BigQuery,
                DocumentProcessorServiceClient,
                GoogleAuth,
                fs,
                path,
                FormData,
                reqQuery,
                reqBody: req.body,
                chatBotId,
                headers,
                parser,
                generator,
                json5,
                htmlToText,
              },
              sanitizedQuestion,
              onToken,
            );

            // Save Q&A only when there is an actual question and answer, and the
            if (sanitizedQuestion && response?.text && !res.destroyed) {
                await saveChatHistory(
                    session,
                    chatBotId,
                    user,
                    sanitizedQuestion,
                    response.text,
                    graphIds || [],
                    response.tokens
                );
            }

            if (isStreaming) {
              sendFinal(response);
            } else {
              res.status(200).json(response);
            }
            resolve(response);
          } catch (error: any) {
            if (isStreaming) {
              // Headers are already flushed with a 200 — the error has to travel
              // in-band, same as the frontend already treats `data.error` today.
              sendFinal({
                text: '',
                src: 'talkingDb',
                error: true,
                errorMessage: error?.message || 'Something went wrong',
              });
            } else {
              const upstream = error?.status ?? error?.response?.status;
              const status =
                Number.isInteger(upstream) && upstream >= 400 && upstream <= 599
                  ? upstream
                  : 500;
              res
                .status(status)
                .json({ error: error?.message || 'Something went wrong' });
            }
            resolve(error);
          }
        })
        .catch((error) => {
    // Fallback to default server config when chatbot-specific one is missing
          import(`@/configuration/default/server`)
            .then(async (module) => {
              try {
                const response = await module.start(
                  {
                    chain,
                    axiosInstance: axios,
                    user,
                    graphIds,
                    BigQuery,
                    DocumentProcessorServiceClient,
                    GoogleAuth,
                    fs,
                    path,
                    FormData,
                    reqQuery,
                    chatBotId,
                    headers,
                    parser,
                    generator,
                    json5,
                    htmlToText,
                  },
                  sanitizedQuestion,
                );

            // Save Q&A — fallback path
            if (sanitizedQuestion && response?.text) {
                await saveChatHistory(
                    session,
                    chatBotId,
                    user,
                    sanitizedQuestion,
                    response.text,
                    graphIds || [],
                    response.tokens
                );
            }

                res.status(200).json(response);
                resolve(response);
              } catch (fallbackError: any) {
                res.status(500).json({ error: fallbackError?.message || 'Something went wrong' });
                resolve(fallbackError);
              }
            })
            .catch((importError) => {
              res.status(500).json({ error: 'Chat service unavailable' });
              resolve(importError);
            });
        });
    });
  } catch (error: any) {
    console.log('error', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
