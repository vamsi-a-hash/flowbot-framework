import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/config/mongodb';
import { getUsers } from '@/models/userModel';
import { isAdmin } from '@/utils/adminAuth';
import { getVerifiedEmail } from '@/utils/auth';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    try {
        await dbConnect();
        if (req.method === 'GET') {
            const email = getVerifiedEmail(req);
            if (!isAdmin(email)) {
                return res.status(403).json({
                    error: 'Forbidden',
                });
            }

            const DEFAULT_SKIP = 0;
            const DEFAULT_LIMIT = 20;
            const MAX_LIMIT = 100;

            const skipParam = req.query.skip;
            const limitParam = req.query.limit;

            const skip = skipParam === undefined? DEFAULT_SKIP: Number(skipParam);
            const limit = limitParam === undefined? DEFAULT_LIMIT: Number(limitParam);

            if (!Number.isInteger(skip) || skip < 0 || !Number.isInteger(limit) || limit <= 0 || limit > MAX_LIMIT) {
                return res.status(400).json({
                    error: `Invalid pagination parameters. skip must be a non-negative integer and limit must be between 1 and ${MAX_LIMIT}.`,
                });
            }

            const users = await getUsers(skip, limit);
            return res.status(200).json(users);
        }

        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    } catch (error: any) {
        return res.status(error.status || 500).json({
            error: error.message || 'Something went wrong',
        });
    }
}