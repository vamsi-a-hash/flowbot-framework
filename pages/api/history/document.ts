import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/config/mongodb';
import { upsertUserHistory, pushDocumentEntry, pullDocumentEntry } from '@/models/userHistoryModel';
import { getUserIdByEmail } from '@/models/userModel';
import { getVerifiedEmail } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'DELETE') {
        const { sessionId, jobId } = req.body || {};
        if (!sessionId || !jobId) {
            return res.status(400).json({ error: 'sessionId and jobId are required' });
        }
        try {
            await dbConnect();
            await pullDocumentEntry(sessionId, jobId);
            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('Failed to remove document from history:', err);
            return res.status(500).json({ error: err.message || 'Something went wrong' });
        }
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sessionId, chatbotId, graphId, name, size, type, jobId } = req.body || {};

    if (!sessionId || !graphId || !name) {
        return res.status(400).json({ error: 'sessionId, graphId and name are required' });
    }

    try {
        const email = await getVerifiedEmail(req);

        await dbConnect();

        const userId = await getUserIdByEmail(email);

        await upsertUserHistory(sessionId, chatbotId || '', email, userId);
        await pushDocumentEntry(sessionId, { name, size: size || 0, type: type || '', jobId: jobId || '', graphId });

        return res.status(200).json({ success: true });
    } catch (err: any) {
        if (err.status) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error('Failed to record document upload in history:', err);
        return res.status(500).json({ error: err.message || 'Something went wrong' });
    }
}
