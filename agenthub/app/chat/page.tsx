'use client'

import React, { useState, useRef, useEffect } from 'react';
import { ChatEditor } from '@/components/chat/editor/Editor';
import { useMounted } from '@/lib/mounted';

import { Message, Chat } from '@/interfaces/agentchat';
import { Sidebar } from '@/components/agentchat/Sidebar';
import { Header } from '@/components/agentchat/Header';
import { MessageList } from '@/components/agentchat/MessageList';
import axios from 'axios';
import { AgentCommand } from '@/components/chat/body/message-box';
import { baseUrl, serverUrl } from '@/lib/env';
import { generateSixDigitId } from '@/lib/utils';



const updateChatName = (chatId: number, newName: string) => {
  // setChats(prevChats => 
  //   prevChats.map(chat => 
  //     chat.id === chatId ? { ...chat, name: newName } : chat
  //   )
  // );
};







const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [chats, setChats] = useState<Chat[]>([{ id: 1, name: 'General' }]);
  const [activeChat, setActiveChat] = useState<number>(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function parseText(input: string): string {
    // Step 1: Replace mention spans with the custom format
    let parsed = input.replace(/<span class="mention" data-type="mention" data-id="([^"]+)">@[^<]+<\/span>/g, '?>>$1/?>>');

    // Step 2: Convert <br> tags to newlines
    parsed = parsed.replace(/<br[^>]*>/g, '\n');

    // Step 3: Remove all remaining HTML tags
    parsed = parsed.replace(/<[^>]+>/g, '');

    // Decode HTML entities (e.g., &quot;, &amp;)
    parsed = parsed.replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'");

    return parsed.trim();
  }

  interface MessageBundle {
    name: string;
    content: string;
  }

  interface CommandResponse {
    name: string | undefined;
    content: string;
    attachments?: string[];
  }

  function parseNamedContent(inputString: string, attachments?: string[]): AgentCommand[] {
    const regex = /\?>>(.*?)\/?>>([^?]*)/g;
    const results: AgentCommand[] = [];

    let match;
    while ((match = regex.exec(inputString)) !== null) {
      const name = match[1].trim().slice(0, -2);
      const content = match[2].replace(/^\s+|\s+$/g, '');

      // Only add attachments if they exist
      const command: AgentCommand = {
        name,
        content
      };
      
      // Only add attachments property if there are attachments
      if (attachments && attachments.length > 0) {
        command.attachments = attachments;
      }

      results.push(command);
    }

    return results;
  }

  // Ex


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (content: string, attachments: File[]) => {
    if (content.trim() || attachments.length > 0) {
      let uploadedFiles: string[] = [];
      
      // Handle file uploads
      if (attachments.length > 0) {
        const uploads = await Promise.all(
          attachments.map(async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            try {
              const response = await axios.post(`${baseUrl}/api/upload`, formData);
              return response.data.url;
            } catch (error) {
              console.error('File upload failed:', error);
              return null;
            }
          })
        );
        uploadedFiles = uploads.filter(url => url !== null);
      }

      const newMessage: Message = {
        id: generateSixDigitId(),
        text: content,
        sender: 'user',
        timestamp: new Date(),
        attachments: uploadedFiles,
        thinking: false
      };

      // Use functional update to ensure state correctness
      setMessages(prevMessages => [...prevMessages, newMessage]);

      const messageId = generateSixDigitId();
      const botMessage: Message = {
        id: messageId,
        text: ``,
        sender: 'bot',
        timestamp: new Date(),
        thinking: true
      };

      setMessages(prevMessages => [...prevMessages, botMessage]);

      try {
        const command = parseNamedContent(parseText(content), uploadedFiles)[0];
        const res = await processAgentCommand(command as AgentCommand);

        setMessages(prevMessages => 
          prevMessages.map(message => 
            message.id === messageId 
              ? { 
                  ...message, 
                  thinking: false, 
                  text: res.content,
                  attachments: res.attachments
                }
              : message
          )
        );
      } catch (error) {
        console.error('Error processing command:', error);
        setMessages(prevMessages => 
          prevMessages.map(message => 
            message.id === messageId 
              ? { 
                  ...message, 
                  thinking: false, 
                  text: "Error processing your request. Please try again.",
                }
              : message
          )
        );
      }
    }
  };

  const addChat = () => {
    const newChat: Chat = { id: Date.now(), name: `Chat ${chats.length + 1}` };
    setChats([...chats, newChat]);
    setActiveChat(newChat.id);
  };

  const processAgentCommand = async (command: AgentCommand): Promise<CommandResponse> => {
    // Temporary measure to prevent hanging until draft is published
    if (!command) {
      return {
        name: undefined,
        content: "You must provide a mention to use AIOS. (@example/...)",
        attachments: undefined
      }
    }

    // Handle image attachments (if any)
    let taskInput = command.content;
    if (command.attachments && command.attachments.length > 0) {
      const attachmentUrls = command.attachments.map(url => `${baseUrl}${url}`);
      taskInput = `${command.content}\n\nImage Content：${attachmentUrls.join('\n')}\n\nPlease answer the question based on the image content above.`;
    }

    const addAgentResponse = await axios.post(`${baseUrl}/api/proxy`, {
      type: 'POST',
      url: `${serverUrl}/add_agent`,
      payload: {
        agent_name: command.name,
        task_input: taskInput,
        attachments: command.attachments?.map(url => `${baseUrl}${url}`),
        has_image: command.attachments && command.attachments.length > 0
      }
    });

    console.log(addAgentResponse.data);

    // Wait for 1050ms
    await new Promise(resolve => setTimeout(resolve, 1050));

    let recent_response: any;

    try {
      // Second request: Execute agent
      const executeAgentResponse = await axios.post(`${baseUrl}/api/proxy`, {
        type: 'GET',
        url: `${serverUrl}/execute_agent?pid=${addAgentResponse.data.pid}`,
      });

      console.log(executeAgentResponse.data);
      recent_response = executeAgentResponse.data.response.result.content;

      if (typeof recent_response !== 'string') {
        recent_response = "Agent Had Difficulty Thinking"
      }
    } catch (e) {
      recent_response = command.attachments && command.attachments.length > 0 
        ? "Error processing image. Please ensure:\n1. Image format is supported (JPG/PNG/GIF/WebP)\n2. Image size is under 5MB\n3. Verify if the current agent supports image processing"
        : "Agent Had Difficulty Thinking";
    }

    // Always return attachments in the response
    return {
      name: command.name,
      content: recent_response,
      attachments: command.attachments
    };
  };

  const mounted = useMounted();

  return (
    <div className={`flex h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Sidebar
        chats={chats}
        activeChat={activeChat}
        setActiveChat={setActiveChat}
        addChat={addChat}
        updateChatName={updateChatName}
        darkMode={darkMode}
      />
      <div className="flex flex-col flex-grow pb-4">
        <Header darkMode={darkMode} setDarkMode={setDarkMode} />
        <MessageList messages={messages} darkMode={darkMode} />
        <div className='w-full flex h-fit justify-center'>
          {mounted && <ChatEditor onSend={handleSend} darkMode={darkMode} />}
        </div>

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};


export default ChatInterface;
