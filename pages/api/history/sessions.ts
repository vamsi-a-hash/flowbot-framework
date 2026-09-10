import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/config/mongodb';
import { UserHistoryModel, IUserHistory, updateSessionStatus } from '@/models/userHistoryModel';
import { getVerifiedEmail } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET' && req.method !== 'DELETE' && req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let email: string;
    try {
        email = getVerifiedEmail(req);
    } catch (err: any) {
        return res.status(err.status || 401).json({ error: err.message || 'Not authenticated' });
    }

    await dbConnect();

    
    // ── DELETE: remove a session record ───────────────────────────────────────
    if (req.method === 'DELETE') {
        const { sessionId } = req.query;
        if (!sessionId || typeof sessionId !== 'string') {
            return res.status(400).json({ error: 'sessionId is required' });
        }
        try {
            const result = await UserHistoryModel.deleteOne({ sessionId, email });
            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Session not found' });
            }
            console.log(`[DELETE /api/history/sessions?sessionId=${sessionId}]`);
            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error(`[DELETE /api/history/sessions?sessionId=${sessionId}] error:`, err);
            return res.status(500).json({ error: err.message || 'Something went wrong' });
        }
    }

    // ── PATCH: update sessionstatus in a session record ───────────────────────────────────────
    if (req.method === 'PATCH') {
        const { sessionId, sessionStatus } = req.body;
        if (!sessionId || typeof sessionId !== 'string') {
            return res.status(400).json({ error: 'sessionId is required' });
        }

        try {
            const response = await updateSessionStatus(sessionId, email, sessionStatus)
            
            if (!response) return res.status(404).json({error: 'Session not found' });
            return res.status(200).json(response);
        } catch (err: any) {
            return res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
        }
    }

    // ── Detail: sessionId provided ────────────────────────────────────────────
    if (req.method === 'GET') {
        const { sessionId } = req.query;
        if (sessionId && typeof sessionId === 'string') {
            try {
                const record = await UserHistoryModel
                    .findOne({ sessionId, email })  // email scope prevents cross-user reads
                    .lean<IUserHistory | null>();

                if (!record) {
                    return res.status(404).json({ error: 'Session not found' });
                }

                const response = {
                    sessionId: record.sessionId,
                    chatbotId: record.chatbotId,
                    sessionStatus: record.sessionStatus,
                    email:     record.email,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt,
                    documents: record.documents,
                    chats:     record.chats,
                };


                return res.status(200).json(response);
            } catch (err: any) {
                console.error(`[GET /api/history/sessions?sessionId=${sessionId}] error:`, err);
                return res.status(500).json({ error: err.message || 'Something went wrong' });
            }
        }

        // ── List: no sessionId — return all sessions for this user ────────────────
        try {
            const sessions = await UserHistoryModel
                .find({ email })
                .sort({ createdAt: -1 })
                .select({
                    sessionId: 1,
                    chatbotId: 1,
                    createdAt: 1,
                    sessionStatus: 1,
                    chats:     { $slice: 1 },  // only first chat entry for preview
                })
                .lean<IUserHistory[]>();

            const response = sessions.map((s) => ({
                sessionId:     s.sessionId,
                sessionStatus: s.sessionStatus,
                chatbotId:     s.chatbotId,
                createdAt:     s.createdAt,
                firstQuestion: s.chats?.[0]?.question || null,
            }));

            return res.status(200).json(response);
        } catch (err: any) {
            console.error('[GET /api/history/sessions] error:', err);
            return res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
        }
    }
}

