import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/config/mongodb';
import { upsertUserHistory, pushDocumentEntry, pullDocumentEntry } from '@/models/userHistoryModel';
import { getUserIdByEmail } from '@/models/userModel';
import { getVerifiedEmail } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'DELETE') {
        const { sessionId, jobId } = req.body || {};
        if (typeof sessionId !== 'string' || !sessionId || typeof jobId !== 'string' || !jobId) {
            return res.status(400).json({ error: 'sessionId and jobId are required' });
        }
        try {
            const email = await getVerifiedEmail(req); // throws 401 if not authenticated
            await dbConnect();
            const { matched } = await pullDocumentEntry(sessionId, email, jobId);
            if (!matched) {
                return res.status(404).json({ error: 'Session not found' });
            }
            return res.status(200).json({ success: true });
        } catch (err: any) {
            if (err.status) {
                console.error(err.message)
                return res.status(500).json({ error: "Something went wrong" });
            }
            console.error('Failed to remove document from history:', err);
            return res.status(500).json({ error: 'Something went wrong' });
        }
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sessionId, chatbotId, graphId, name, size, type, jobId } = req.body || {};

    if (
        typeof sessionId !== 'string' || !sessionId ||
        typeof graphId !== 'string' || !graphId ||
        typeof jobId !== 'string' || !jobId
    ) {
        return res.status(400).json({ error: 'sessionId, graphId, and jobId are required' });
    }

    try {
        const email = await getVerifiedEmail(req);

        await dbConnect();

        const userId = await getUserIdByEmail(email);

        await upsertUserHistory(sessionId, chatbotId || '', email, userId);
        await pushDocumentEntry(sessionId, { name, size: size || 0, type: type || '', jobId: jobId , graphId });

        return res.status(200).json({ success: true });
    } catch (err: any) {
    if (err.status) {
        return res.status(500).json({ error: 'something went wrong' });
    }
    console.error('Failed to record document upload in history:', err);
    return res.status(500).json({ error: 'Something went wrong' });
}
}