import { Dispatch, SetStateAction, ReactNode } from 'react';

export interface HeaderProps {
    setSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

export interface SidebarProps {
    setSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

export interface AdminLayoutProps {
    children: ReactNode;
}

export interface UserDetails {
    name: string;
    email: string;
    inputTokensUsed: number;
    outputTokensUsed: number;
    totalTokensUsed: number;
}

export interface UsersListProps {
    users: UserDetails[];
    selectedUserEmail: string;
    onSelect: (user: UserDetails) => void;
}