import React from 'react';
import { UsersListProps } from '@/types/admin';

const UsersList: React.FC<UsersListProps> = ({
    users,
    selectedUserEmail,
    onSelect,
}) => {
    return (
        <>
            <div className="flex h-9 items-center border-b border-slate-200 px-4 text-xs font-medium text-slate-600">
                {users.length} user/s
            </div>
            <div className="max-h-[calc(100vh-360px)] overflow-y-auto">
                {users.map((user) => (
                    <div
                        key={user.email}
                        onClick={() => onSelect(user)}
                        className={`flex w-full items-center gap-4 border-b border-slate-200 px-4 py-3 text-left transition-colors ${selectedUserEmail === user.email
                                ? 'bg-blue-50'
                                : 'bg-white hover:bg-slate-50'
                            }`}
                    >
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-semibold text-slate-900">
                                {user.name}
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-500">
                                {user.email}
                            </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-6 text-right">
                            <div>
                                <div className="text-[11px] text-slate-400">
                                    Input
                                </div>
                                <div className="text-xs font-medium text-slate-700">
                                    {user.inputTokensUsed.toLocaleString()}
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] text-slate-400">
                                    Output
                                </div>
                                <div className="text-xs font-medium text-slate-700">
                                    {user.outputTokensUsed.toLocaleString()}
                                </div>
                            </div>
                            <div className="min-w-[80px]">
                                <div className="text-[11px] text-slate-400">
                                    Total
                                </div>
                                <div className="text-xs font-semibold text-slate-900">
                                    {user.totalTokensUsed.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {users.length === 0 && (
                    <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                        No users found.
                    </div>
                )}
            </div>
        </>
    );
};

export default UsersList;