import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronsLeft } from 'lucide-react';
import { SidebarProps } from '@/types/admin';

const Sidebar = ({ setSidebarOpen }: SidebarProps) => {
    const router = useRouter();

    const isActive = (path: string) => {
        return router.pathname === path;
    };

    return (
        <aside className="relative w-60 shrink-0 border-r border-slate-200 bg-white">
            <div className="px-4 pt-9">
                <div className="mb-3 px-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Admin
                </div>
                <Link
                    href="/admin"
                    className={`flex h-10 w-full items-center gap-4 rounded-lg px-4 text-sm font-medium ${isActive('/admin')
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-900 hover:bg-slate-50'
                        }`}
                >
                    Feedback
                </Link>
                <Link
                    href="/admin/users"
                    className={`flex h-10 w-full items-center gap-4 rounded-lg px-4 text-sm font-medium ${isActive('/admin/users')
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-900 hover:bg-slate-50'
                        }`}
                >
                    Users
                </Link>
            </div>
            <button
                type="button"
                className="absolute bottom-8 left-8 flex items-center gap-3 text-sm text-slate-700"
                onClick={() => setSidebarOpen((prev) => !prev)}
            >
                <ChevronsLeft className="h-4 w-4" />
                Collapse
            </button>
        </aside>
    );
};

export default Sidebar;