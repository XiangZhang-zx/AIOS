export interface AgentCommand {
  name: string;
  content: string;
  attachments?: string[];
}

export interface ChatMessageProps {
  role: string;
  content: string;
  attachments?: string[];
} 