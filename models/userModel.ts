import { UserDetails } from '@/types/admin';
import mongoose, { Schema, Document } from 'mongoose';

// Lean user profile — one record per real person, keyed by email.
// Session tracking lives in user_histories, not here.
export interface IUser extends Document {
    email: string;
    name: string;
    subscriptionType: string;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema: Schema = new Schema({
    email: {
        type: String,
        unique: true,   // one record per person
        sparse: true,   // allows anonymous (null) without unique collision
    },
    name: {
        type: String,
            default: '',
    },
    subscriptionType: {
        type: String,
        default: 'FREE',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    versionKey: false,
});

UserSchema.method("getUserDocument", function () {
    return this
});

UserSchema.method('updateUserDetails', async function (email: string, name: string) {
    if (email) this.email = email;
    if (name)  this.name = name;
    this.updatedAt = new Date();
    await this.save()
    return this
});

export const UserModel =
    mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

/**
 * Upsert by email — called at login (/api/auth/session) and at chat time.
 * Creates the user profile if it doesn't exist, updates name if it does.
 */
export const upsertUserByEmail = async (
    email: string,
    name: string
): Promise<IUser> => {
    const result = await UserModel.findOneAndUpdate(
        { email },
        {
            $set:         { name },
            $setOnInsert: { email, createdAt: new Date() },
            $currentDate: { updatedAt: true },
        },
        { new: true, upsert: true }
    );
    return result as IUser;
}

export const getUserIdByEmail = async (
    email: string
): Promise<mongoose.Types.ObjectId | null> => {
    const user = await UserModel.findOne({ email }).select('_id').lean<{ _id: mongoose.Types.ObjectId } | null>();
    return user?._id ?? null;
};

export async function getUsers(
    skip: number = 0,
    limit: number = 10
): Promise<{
    users: UserDetails[];
    total: number;
}> {

    const result = await UserModel.aggregate([
        {
          $facet: {
            users: [
              {
                $sort: { createdAt: -1, _id: -1 },
              },
              {
                $skip: skip,
              },
              {
                $limit: limit,
              },
              {
                $lookup: {
                  from: 'usertokenusages',
                  localField: '_id',
                  foreignField: 'userId',
                  as: 'tokenUsage',
                },
              },
              {
                $unwind: {
                  path: '$tokenUsage',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $project: {
                  _id: 0,
                  name: 1,
                  email: 1,
                  inputTokensUsed: {
                    $ifNull: ['$tokenUsage.inputTokensUsed', 0],
                  },
                  outputTokensUsed: {
                    $ifNull: ['$tokenUsage.outputTokensUsed', 0],
                  },
                  totalTokensUsed: {
                    $ifNull: ['$tokenUsage.totalTokensUsed', 0],
                  },
                },
              },
            ],
      
            total: [
              {
                $count: 'count',
              },
            ],
          },
        },
    ]);
      
    const users = result[0]?.users ?? [];
    const total = result[0]?.total[0]?.count ?? 0;
    return {
        users,
        total,
    };
}

export default UserModel;