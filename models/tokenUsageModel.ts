import mongoose, { Schema, Document } from 'mongoose';
import { ITokenUsage } from './userHistoryModel';

export interface IUserTokenUsage extends Document {
  userId: mongoose.Types.ObjectId;
  inputTokensUsed: number;
  outputTokensUsed: number;
  totalTokensUsed: number;
  quotaLockUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserTokenUsageSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    inputTokensUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    outputTokensUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalTokensUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    quotaLockUntil: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  },
);

export const UserTokenUsageModel =
  mongoose.models.UserTokenUsage ||
  mongoose.model<IUserTokenUsage>('UserTokenUsage', UserTokenUsageSchema);

//   --------------------------------------

// Update actual token usage + release lock
export const updateTokenUsageAndReleaseLock = async (
  userId: mongoose.Types.ObjectId,
  tokens: ITokenUsage,
) => {
  const inputTokens = tokens.input_tokens ?? 0;
  const outputTokens = tokens.output_tokens ?? 0;
  const totalTokens = tokens.total_tokens ?? 0;

  return await UserTokenUsageModel.findOneAndUpdate(
    { userId },
    {
      $inc: {
        inputTokensUsed: inputTokens,
        outputTokensUsed: outputTokens,
        totalTokensUsed: totalTokens,
      },
      $set: {
        quotaLockUntil: null,
      },
      $currentDate: {
        updatedAt: true,
      },
    },
    {
      new: true,
    },
  );
};

// Ensure usage document exists
export const ensureUserTokenUsage = async (userId: mongoose.Types.ObjectId) => {
  return await UserTokenUsageModel.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        userId,
        inputTokensUsed: 0,
        outputTokensUsed: 0,
        totalTokensUsed: 0,
        quotaLockUntil: null,
        createdAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
    },
  );
};

// Atomically acquire quota lock + check quota
export const acquireQuotaLock = async (
  userId: mongoose.Types.ObjectId,
  tokenLimit: number,
  estimatedTokens: number,
  lockDurationMs: number,
) => {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + lockDurationMs);

  const result = await UserTokenUsageModel.findOneAndUpdate(
    {
      userId,

      // Lock is available if there is no active lock
      $or: [{ quotaLockUntil: null }, { quotaLockUntil: { $lte: now } }],

      // Quota check happens as part of the same atomic operation
      $expr: {
        $lte: [
          {
            $add: ['$totalTokensUsed', estimatedTokens],
          },
          tokenLimit,
        ],
      },
    },
    {
      $set: {
        quotaLockUntil: lockUntil,
      },
      $currentDate: {
        updatedAt: true,
      },
    },
    {
      new: true,
    },
  );

  return result !== null;
};

// Release lock without updating tokens
export const releaseQuotaLock = async (userId: mongoose.Types.ObjectId) => {
  return UserTokenUsageModel.findOneAndUpdate(
    { userId },
    {
      $set: {
        quotaLockUntil: null,
      },
      $currentDate: {
        updatedAt: true,
      },
    },
    {
      new: true,
    },
  );
};

export default UserTokenUsageModel;