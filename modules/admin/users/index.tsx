import React, { useEffect, useState } from 'react';
import UsersList from './UserList';
import Pagination from '@/components/ui/Pagination/Pagination';
import { getAllUsers } from '@/apiRequests';
import { Loader } from '@/components/ui';
import { UserDetails } from '@/types/admin';

const USERS_PER_PAGE = 10;

const UserPage = () => {
    const [users, setUsers] = useState<UserDetails[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [totalNumberOfUsers, setTotalNumberOfUsers] = useState<number>(0);
    const [selectedUser, setSelectedUser] = useState<UserDetails | null>();
    const [currentPage, setCurrentPage] = useState(1);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    useEffect(() => {
        const controller = new AbortController();
        const skip = (currentPage - 1) * USERS_PER_PAGE;

        const fetchUsers = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await getAllUsers(
                    skip,
                    USERS_PER_PAGE,
                    controller.signal
                );

                if (response?.success === false) {
                    setError(
                        response.errorMessage || 'Failed to fetch users.'
                    );
                    return;
                }

                setUsers(response?.users || []);
                setTotalNumberOfUsers(response?.total || 0);
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }

                console.error('Failed to fetch users:', error);
                setError('Something went wrong while fetching users.');
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchUsers();

        return () => {
            controller.abort();
        };
    }, [currentPage]);

    return (
        <main className="min-w-0 flex-1 overflow-hidden">
            <div className="mx-auto max-w-[1290px] px-6 pb-8 pt-6">
                <div>
                    <h1 className="text-xl font-semibold text-slate-900">
                        Users
                    </h1>

                    <p className="mt-1 text-sm text-slate-600">
                        View and manage all users of TTT Chatbot.
                    </p>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-5">
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        {loading && users.length === 0 ? (
                            <Loader />
                        ) : (
                            <>
                                {error && (
                                    <div className="px-4 py-3 text-sm font-medium text-red-600">
                                        {error}
                                    </div>
                                )}

                                <UsersList
                                    users={users}
                                    selectedUserEmail={String(
                                        selectedUser?.email
                                    )}
                                    onSelect={setSelectedUser}
                                />

                                {users.length > 0 && (
                                    <Pagination
                                        currentPage={currentPage}
                                        totalItems={totalNumberOfUsers}
                                        itemsPerPage={USERS_PER_PAGE}
                                        onPageChange={handlePageChange}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
};


export default UserPage;