import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import { User, ChatMessage } from '../types';
import { 
  Send, 
  Search, 
  User as UserIcon, 
  Clock, 
  MoreVertical,
  Check,
  CheckCheck,
  Circle,
  Hash,
  Paperclip,
  Smile,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { Button } from './ui';

export default function Chat() {
  const { users, user, chats, sendChatMessage, setActiveTab } = useApp();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emojis = ['👍', '🤝', '✅', '🏠', '📞', '📈', '🚀', '⭐', '📍', '💰'];

  const selectedUser = users.find(u => u.id === selectedUserId);
  
  const filteredUsers = users.filter(u => 
    u.id !== user?.id && 
    (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     u.role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const conversation = chats.filter(c => 
    (c.senderId === user?.id && c.receiverId === selectedUserId) || 
    (c.senderId === selectedUserId && c.receiverId === user?.id)
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim() || !selectedUserId) return;
    
    try {
      await sendChatMessage(selectedUserId, message.trim());
      setMessage('');
      setShowEmoji(false);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setMessage(prev => prev + emoji);
  };

  const handleAttachment = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const attachmentText = `📎 Attached: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      sendChatMessage(selectedUserId!, attachmentText);
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex p-8 gap-8 animate-in fade-in duration-500">
      {/* Sidebar: User List */}
      <div className="w-80 flex flex-col bg-[var(--color-bg-card)] border border-[var(--color-border-main)] rounded-[40px] overflow-hidden shadow-2xl shadow-black/20">
        <div className="p-8 border-b border-[var(--color-border-main)]">
          <h2 className="text-xl font-black text-[var(--color-text-main)] tracking-tighter uppercase mb-6 flex items-center gap-2">
            <Hash className="w-5 h-5 text-accent" />
            Internal Channels
          </h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-dim)]" />
            <input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search team..."
              className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-2xl pl-11 pr-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-main)] focus:outline-none focus:border-accent/40 placeholder:text-[var(--color-text-dim)]/50 font-sans"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-accent/20 p-4 space-y-2">
          {filteredUsers.map(u => {
            const lastMsg = chats.filter(c => 
              (c.senderId === user?.id && c.receiverId === u.id) || 
              (c.senderId === u.id && c.receiverId === user?.id)
            ).pop();

            return (
              <button
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-3xl transition-all group",
                  selectedUserId === u.id 
                    ? "bg-accent/10 border border-accent/20 shadow-lg shadow-black/20" 
                    : "hover:bg-[var(--color-text-main)]/5 border border-transparent"
                )}
              >
                <div className="relative">
                  <div className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black shadow-lg border border-[var(--color-border-main)]",
                    selectedUserId === u.id ? "bg-accent text-white" : "bg-[var(--color-bg-main)] text-[var(--color-text-dim)]"
                  )}>
                    {u.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-[3px] border-[var(--color-bg-card)]" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <p className={cn(
                      "text-[10px] font-black uppercase tracking-tight truncate",
                      selectedUserId === u.id ? "text-accent" : "text-[var(--color-text-main)]"
                    )}>{u.name}</p>
                    {lastMsg && (
                      <span className="text-[8px] font-mono text-[var(--color-text-dim)] uppercase">
                        {format(new Date(lastMsg.timestamp), 'HH:mm')}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-[var(--color-text-dim)] font-bold uppercase tracking-[0.05em] truncate italic font-sans">
                    {lastMsg ? `"${lastMsg.text}"` : u.role}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[var(--color-bg-card)] border border-[var(--color-border-main)] rounded-[40px] overflow-hidden shadow-2xl shadow-black/20 relative">
        {selectedUser ? (
          <>
            {/* Header */}
            <div className="p-8 border-b border-[var(--color-border-main)] flex justify-between items-center bg-[var(--color-text-main)]/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20">
                  <UserIcon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--color-text-main)] uppercase tracking-tight">{selectedUser.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] text-[var(--color-text-dim)] font-bold uppercase tracking-widest">{selectedUser.role} • Frequency Active</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-3 text-[var(--color-text-dim)] hover:text-accent bg-[var(--color-bg-main)] rounded-2xl border border-[var(--color-border-main)] transition-colors">
                  <Info className="w-4 h-4" />
                </button>
                <button className="p-3 text-[var(--color-text-dim)] hover:text-accent bg-[var(--color-bg-main)] rounded-2xl border border-[var(--color-border-main)] transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-thin scrollbar-thumb-accent/20"
            >
              {conversation.length > 0 ? (
                conversation.map((msg, i) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div 
                      key={msg.id} 
                      className={cn(
                        "flex flex-col max-w-[70%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                        isMe ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div className={cn(
                        "p-5 rounded-[28px] shadow-lg relative group",
                        isMe 
                          ? "bg-accent text-white rounded-tr-none border-b-4 border-accent/20" 
                          : "bg-[var(--color-bg-main)] text-[var(--color-text-main)] rounded-tl-none border-b-4 border-[var(--color-border-main)]"
                      )}>
                        <p className="text-[11px] font-bold font-sans tracking-wide leading-relaxed">{msg.text}</p>
                        {msg.taskId && (
                          <div 
                            onClick={() => setActiveTab('tasks')}
                            className={cn(
                              "mt-3 pt-3 border-t text-[9px] font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:underline opacity-80",
                              isMe ? "border-white/20" : "border-[var(--color-border-main)]"
                            )}>
                            <Clock className="w-3 h-3" />
                            Relational Task Unit
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 px-1">
                        <span className="text-[8px] font-mono text-[var(--color-text-dim)] uppercase">
                          {format(new Date(msg.timestamp), 'HH:mm')}
                        </span>
                        {isMe && <CheckCheck className="w-2.5 h-2.5 text-accent" />}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-40">
                  <Hash className="w-24 h-24 mb-6 text-accent" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-main)]">Secure Uplink Established</p>
                  <p className="text-[8px] font-bold uppercase mt-2 italic text-[var(--color-text-dim)]">Idle signal awaiting input...</p>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-8 border-t border-[var(--color-border-main)] bg-[var(--color-text-main)]/[0.02]">
              <div className="relative mb-4">
                {showEmoji && (
                  <div className="absolute bottom-full left-0 mb-4 p-4 bg-[var(--color-bg-card)] border border-[var(--color-border-main)]/30 rounded-2xl flex gap-3 shadow-2xl animate-in slide-in-from-bottom-2 duration-200 z-[60]">
                    {emojis.map(e => (
                      <button 
                        key={e} 
                        onClick={() => handleEmojiClick(e)}
                        className="text-xl hover:scale-125 transition-transform"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <form onSubmit={handleSend} className="flex gap-4 items-center">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={onFileChange}
                />
                <button 
                  type="button" 
                  onClick={handleAttachment}
                  className="p-3 text-[var(--color-text-dim)] hover:text-accent transition-colors bg-[var(--color-bg-main)] rounded-2xl border border-[var(--color-border-main)]"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <input 
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Enter message..."
                    className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-3xl px-8 py-5 text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:border-accent/40 placeholder:text-slate-500 font-sans shadow-inner"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => setShowEmoji(!showEmoji)}
                      className={cn("transition-colors", showEmoji ? "text-accent" : "text-slate-400 hover:text-accent")}
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <Button 
                  onClick={() => handleSend()}
                  type="submit"
                  disabled={!message.trim()}
                  className="w-14 h-14 bg-accent text-white rounded-[24px] hover:bg-accent/90 shadow-lg shadow-accent/20 flex items-center justify-center transition-all disabled:opacity-30 disabled:grayscale"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
            <div className="w-24 h-24 rounded-[40px] bg-[var(--color-text-main)]/[0.02] flex items-center justify-center mb-8 border border-[var(--color-border-main)]">
              <UserIcon className="w-10 h-10 text-[var(--color-text-dim)]" />
            </div>
            <h3 className="text-xl font-black text-[var(--color-text-main)] uppercase tracking-tighter mb-2">No Active Discussion</h3>
            <p className="text-[10px] text-[var(--color-text-dim)] font-bold uppercase tracking-widest max-w-[200px] leading-loose italic">
              Select a team member to initiate secure correspondence
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
