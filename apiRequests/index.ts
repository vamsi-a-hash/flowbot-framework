import axios from 'axios';
import { ChatbotsResponse, LiveChatbot } from "@/types/chat";
import { FeedbackPayload } from "@/types/feedback";
import { HistorySessionSummary, HistorySessionDetail } from "@/types/history";
import { axiosPDFInstance, axiosConvInstance } from "@/utils/axiosInstance"
import { IFeedback } from "@/models/feedback";

type CHAT_ID = string | string[] | undefined

export const getPDFList = async (chatId: CHAT_ID) => {
    try {
        const response = await axiosPDFInstance.get(`/data/list?chatbot_id=document-${chatId}`);
        return response.data.data;
    } catch (error) {
        return false;
    }
}

export const uploadPDF = async (chatId: CHAT_ID, data: any) => {
    try {
        await axiosPDFInstance.post(`/data/upload?chatbot_id=document-${chatId}`, data);
    } catch (error) {
        console.log(`something went wrong during uploading pdf: ${error}`);
        return false;
    }
}

export const deletePDFList = async (chatId: CHAT_ID) => {
    try {
        await axiosPDFInstance.get(`/chatbot/untrain?chatbot_id=document-${chatId}`);
    } catch (error) {
        
    }
}

export const pdfFileProgress = async (filename: string) => {
    try {
        return await axiosPDFInstance.get(`/data/progress?file_name=${filename}`);
    } catch (error) {
        console.log(`something went wrong during checking the data progress ${error}`);
        return false;
    }
}

export const getConvList = async (chatId: CHAT_ID) => {
    try {
        const response = await axiosConvInstance.get(`/training/training_ids?namespace=${chatId}`);
        return response.data;
    } catch (error) {

    }
}

export const uploadConv = async (chatId: CHAT_ID, data: any) => {
    try {
        await axiosConvInstance.post(`/training/chats?chat_id=${chatId}&book_type=whatsapp-conversation`, data);
    } catch (error) {

    }
}

export const deleteConvList = async (chatId: CHAT_ID) => {
    try {
        await axiosConvInstance.delete(`/training/namespace?chat_id=${chatId}`);
    } catch (error) {

    }
}

export const whatsAppFileProgress = async (filename: string) => {
    try {
        return await axiosConvInstance.get(`/training/progress?training_id=${filename}`);
    } catch (error) {

    }
}


export const getDefaultPromptTemplate = async (chatId: CHAT_ID) => {
    try {
        return await axiosConvInstance.get(`/prompt_template?chat_id=${chatId}`);
    } catch (error) {

    }
}

export const resetPromptTemplate = async (chatId: CHAT_ID) => {
    try {
        return await axiosConvInstance.post(`/prompt_template/reset?chat_id=${chatId}`);
    } catch (error) {

    }
}

export const submitPromptTemplate = async (chatId: CHAT_ID, data: any) => {
    try {
        return await axiosConvInstance.post(`/prompt_template?chat_id=${chatId}`, data);
    } catch (error) {

    }
}


export const deleteDocument = async ( documentName: string, chatId: string | unknown) => {
    try {
        const response = await axiosPDFInstance.delete(`/data/${documentName}?chatbot_id=document-${chatId}`)
        return response;
    } catch (error) {
        console.log(`something went wrong during deleting the doc ${documentName}: ${error}`);
        return false;
    }
}


export const getChatbots = async (): Promise<LiveChatbot[] | null> => {
    try {
        const response: ChatbotsResponse = await axios.get(`/api/chatbot`)
        return response.data.data;
    } catch (error) {
        return null;
    }
}

export const deleteChatbot = async (chatbotId: string) => {
    try {
        const response = await axios.delete(`/api/chatbot/${chatbotId}`)
        return response.data.data;
    } catch (error) {
        return null;
    }
}


export const UploadChatbotZip = async (chatBotId:string, file: File) => {
    try {
        const formData = new FormData()
        formData.append("chatBotId", chatBotId)
        formData.append("file", file)
        const response = await axios.post(`/api/upload`, formData)
        return response;
    } catch (error) {
        // console.log("error occured at UploadChatbotZip ==>", error)
        return null;
    }
}

export const UploadConfig = async (chatBotId: string, fileType: string, serverType: string, file: File ) => {
    try {
        const formData = new FormData()
        formData.append("chatBotId", chatBotId)
        formData.append("fileType", fileType)
        formData.append("serverType", serverType)
        formData.append("file", file)
        const response = await axios.post(`/api/config-upload`, formData)
        return response;
    } catch (error) {
        // console.log("error occured at UploadConfig ==>", error)
        return null;
    }
}


export const cloneChatbot = async (chatbotId: string, newChatbotId: string) => {
    try {
        const body = {
            chatbotId,
            newChatbotId
        }
        const data = await axios.post(`/api/clone-chatbot`, body)
        return data
    } catch (error) {
        return null
    }
}


export const fetchJsConfig = async (chatbotId: string, type: string) => {
    try {
        const body = {
            chatbotId,
            type
        }
          
        const res = await axios.post(`/api/config/chatbot-js`, body)
        return res
    } catch (error) {
        return null
    }
}



export const updateConfig = async (chatbotId: string, type: string, content: string) => {
    try {
        const body = {
            type,
            content
        }

        const res = await axios.post(`/api/chatbot/${chatbotId}`, body)
        return res
    } catch (error) {
        return null
    }
}

// ─── Chat history ───────
export const updateSessionStatus = async (sessionId: string, sessionStatus: string): Promise<HistorySessionSummary | null> => {
    try {
        const { data } = await axios.patch(`/api/history/sessions`, {sessionId, sessionStatus } )
        return data
    } catch (error) {
        return null
    }
}

export const listHistorySessions = async (): Promise<HistorySessionSummary[]> => {
    try {
        const { data } = await axios.get(`/api/history/sessions`)
        return Array.isArray(data) ? data : []
    } catch (error) {
        return []
    }
}

export const getHistorySession = async (sessionId: string): Promise<HistorySessionDetail | null> => {
    try {
        const { data } = await axios.get(`/api/history/sessions`, { params: { sessionId } })
        return data
    } catch (error) {
        return null
    }
}

export const removeHistoryDocument = async (sessionId: string, jobId: string): Promise<boolean> => {
    try {
        const res = await fetch('/api/history/document', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, jobId }),
        });
        return res.ok;
    } catch (err) {
        console.error('removeHistoryDocument failed:', err);
        return false;
    }
};

export const deleteHistorySession = async (
    sessionId: string
): Promise<{ ok: boolean; status?: number }> => {
    try {
        await axios.delete(`/api/history/sessions`, { params: { sessionId } })
        return { ok: true }
    } catch (error) {
        // Surface the status so the UI can treat 404 (already deleted) as success
        // and only show an error for real failures (500, network).
        const status = axios.isAxiosError(error) ? error.response?.status : undefined
        return { ok: false, status }
    }
}

export const getPublicChatLink = async (sessionId: string) => {
    try {
        const response = await axios.post(`/api/chat/public`, {
            sessionId
        });
        return response;
    } catch (error) {
        return null
    }
}

export const getPublicChatData = async (publicChatId: string) => {
    try {
        const response = await axios.get(`/api/chat/public`, {
            params: { publicChatId }
        });
        return response;
    } catch (error) {
        return null
    }
}

export const submitFeedback = async (feedback: FeedbackPayload) => {
    try {
        const response = await axios.post(`/api/feedback`, feedback);
        return response;
    } catch (error) {
        return null
    }
}

export const getAllFeedbacks = async (skip: number, limit: number) => {
    try {
        const response = await axios.get(`/api/feedback`, {
            params: { skip, limit }
        });
        return response.data;
    } catch (error: any) {
        console.log(`something went wrong while fetching feedbacks`, {
            message: error?.message,
            status: error?.response?.status,
            responseData: error?.response?.data
        });
        return {
            success: false,
            errorMessage: error?.message || `something went wrong while fetching feedbacks`
        }
    }
}