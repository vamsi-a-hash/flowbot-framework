import mongoose, { Schema, Document } from 'mongoose';

// ─── Sub-document interfaces ───────────────────────────────────────────────

export interface IDocumentEntry {
    name: string;
    size: number;
    type: string;       // "PDF", "DOCX", etc.
    jobId: string;
    graphId: string;
    uploadedAt: Date;
}

export interface ITokenUsage {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
}

export interface IChatEntry {
    question: string;
    answer: string;
    graphIds: string[]; // which graphs were queried for this specific question
    tokens: ITokenUsage;
    askedAt: Date;
}

// ─── Main document interface ───────────────────────────────────────────────

export interface IUserHistory extends Document {
    userId: mongoose.Types.ObjectId | null; // ref → users._id, null for anonymous
    sessionId: string;
    sessionStatus: string;
    email: string | null;                   // null when user is not logged in
    chatbotId: string;
    documents: IDocumentEntry[];
    chats: IChatEntry[];
    createdAt: Date;
    updatedAt: Date;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────

const DocumentEntrySchema = new Schema<IDocumentEntry>(
    {
        name:       { type: String, required: true },
        size:       { type: Number, default: 0 },
        type:       { type: String, default: '' },
        jobId:      { type: String, default: '' },
        graphId:    { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
    },
    { _id: false }   // no _id on subdocuments
);

const TokenUsageSchema = new Schema<ITokenUsage>(
    {
        input_tokens:  { type: Number, default: 0 },
        output_tokens: { type: Number, default: 0 },
        total_tokens:  { type: Number, default: 0 },
    },
    { _id: false }
);

const ChatEntrySchema = new Schema<IChatEntry>(
    {
        question: { type: String, required: true },
        answer:   { type: String, required: true },
        graphIds: { type: [String], default: [] },
        tokens:   { type: TokenUsageSchema, default: () => ({}) },
        askedAt:  { type: Date, default: Date.now },
    },
    { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────

const UserHistorySchema = new Schema<IUserHistory>(
    {
        userId:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
        sessionId: { type: String, required: true },
        sessionStatus: { type: String, enum: ['ACTIVE', 'INACTIVE'], required: true, default: 'ACTIVE' },
        email:     { type: String, default: null },
        chatbotId: { type: String, required: true },
        documents: { type: [DocumentEntrySchema], default: [] },
        chats:     { type: [ChatEntrySchema], default: [] },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { versionKey: false }
);

// sessionId is the primary lookup key during an active session
UserHistorySchema.index({ sessionId: 1 }, { unique: true });
// email index enables "fetch all sessions for this user" queries
UserHistorySchema.index({ email: 1 });

export const UserHistoryModel =
    mongoose.models.UserHistory ||
    mongoose.model<IUserHistory>('UserHistory', UserHistorySchema);

// ─── Helper functions ─────────────────────────────────────────────────────

/**
 * Creates the history document for a session if it doesn't exist yet.
 * Called at the start of a chat request so subsequent pushes always find a doc.
 */
export const upsertUserHistory = async (
    sessionId: string,
    chatbotId: string,
    email: string | null,
    userId: mongoose.Types.ObjectId | null
): Promise<IUserHistory> => {
    const existing = await UserHistoryModel.findOne({ sessionId });
    if (existing && existing.email !== email) {
        throw { status: 403, message: 'Session does not belong to the authenticated user' };
    }

    const result = await UserHistoryModel.findOneAndUpdate(
        { sessionId },
        {
            $set: { email, userId },
            $currentDate: { updatedAt: true },
            $setOnInsert: { sessionId, chatbotId, createdAt: new Date() },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return result as IUserHistory;
};
/**
 * Appends one Q&A pair to the session's chat array.
 * Only called after module.start() returns successfully in chat.ts.
 */
export const pushChatEntry = async (
    sessionId: string,
    entry: {
        question: string;
        answer: string;
        graphIds: string[];
        tokens?: Partial<ITokenUsage>;
    }
): Promise<void> => {
    await UserHistoryModel.findOneAndUpdate(
        { sessionId },
        {
            $push: {
                chats: {
                    question: entry.question,
                    answer:   entry.answer,
                    graphIds: entry.graphIds,
                    tokens: {
                        input_tokens:  entry.tokens?.input_tokens,
                        output_tokens: entry.tokens?.output_tokens,
                        total_tokens:  entry.tokens?.total_tokens,
                    },
                    askedAt:  new Date(),
                },
            },
            $currentDate: { updatedAt: true },
        }
    );
};

/**
 * Appends one uploaded document record to the session.
 * Called from /api/history/document when the frontend confirms a graphId is ready.
 */
export const pushDocumentEntry = async (
    sessionId: string,
    doc: {
        name: string;
        size: number;
        type: string;
        jobId: string;
        graphId: string;
    }
): Promise<void> => {
    await UserHistoryModel.findOneAndUpdate(
        { sessionId },
        {
            $push: {
                documents: {
                    name:       doc.name,
                    size:       doc.size,
                    type:       doc.type,
                    jobId:      doc.jobId,
                    graphId:    doc.graphId,
                    uploadedAt: new Date(),
                },
            },
            $currentDate: { updatedAt: true },
        }
    );
};

export const getHistoryDocumentBySessionId = async (
    sessionId: string
): Promise<IUserHistory | null> => {
    return await UserHistoryModel.findOne({ sessionId });
};

// updates the status of a session.
export const updateSessionStatus = async (
    sessionId: string,
    email: string,
    status: 'ACTIVE' | 'INACTIVE'
): Promise<IUserHistory | null> => {
    return await UserHistoryModel.findOneAndUpdate(
        { sessionId, email },
        {
            $set: { sessionStatus: status },
            $currentDate: { updatedAt: true },
        },
        { 
            runValidators: true,
            new: true
        }
    );
};

export const pullDocumentEntry = async (
    sessionId: string,
    jobId: string
): Promise<void> => {
    await UserHistoryModel.findOneAndUpdate(
        { sessionId },
        {
            $pull: { documents: { jobId } },
            $currentDate: { updatedAt: true },
        }
    );
};

export default UserHistoryModel;