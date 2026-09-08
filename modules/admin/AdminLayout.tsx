import React, { useState } from 'react';
import Layout from '@/components/layout';
import { AdminLayoutProps } from '@/types/admin';
import Header from './Header';
import Sidebar from './Sidebar';

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <Layout>
            <Header setSidebarOpen={setSidebarOpen} />

            <div className="flex min-h-[calc(100vh-68px)] bg-white">
                {sidebarOpen && (
                    <Sidebar
                        setSidebarOpen={setSidebarOpen}
                    />
                )}

                <main className="flex-1">
                    {children}
                </main>
            </div>
        </Layout>
    );
};

export default AdminLayout;