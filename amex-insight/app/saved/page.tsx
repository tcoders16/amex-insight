"use client"

import { useEffect, useState } from "react"
import { BookmarkIcon, Trash2, MessageSquare, Tag, Clock, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { listSavedChats, deleteSavedChat } from "@/lib/mcp-client"

interface SavedChat {
  chat_id: string
  title: string
  summary: string
  tags: string[]
  created_at: number
  message_count: number
}

export default function SavedChatsPage() {
  const [chats, setChats] = useState<SavedChat[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadChats()
  }, [])

  async function loadChats() {
    setLoading(true)
    const result = await listSavedChats(50)
    if (result.result && !result.error) {
      setChats((result.result as { chats: SavedChat[] }).chats ?? [])
    }
    setLoading(false)
  }

  async function handleDelete(chatId: string) {
    setDeleting(chatId)
    await deleteSavedChat(chatId)
    setChats(prev => prev.filter(c => c.chat_id !== chatId))
    setDeleting(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/chat" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <BookmarkIcon className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Saved Chats</h1>
          <span className="ml-auto text-sm text-gray-400">{chats.length} saved</span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && chats.length === 0 && (
          <div className="text-center py-20">
            <BookmarkIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No saved chats yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Type <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/save</code> in chat to save an important conversation
            </p>
            <Link href="/chat"
              className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
              Go to Chat →
            </Link>
          </div>
        )}

        {/* Chat list */}
        <div className="space-y-3">
          {chats.map(chat => (
            <div key={chat.chat_id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium text-gray-900 truncate">{chat.title}</h2>
                  {chat.summary && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{chat.summary}</p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {chat.message_count} messages
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(chat.created_at * 1000).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric"
                      })}
                    </span>
                  </div>

                  {chat.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Tag className="w-3 h-3 text-gray-400" />
                      {chat.tags.map(tag => (
                        <span key={tag}
                          className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDelete(chat.chat_id)}
                  disabled={deleting === chat.chat_id}
                  className="text-gray-300 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                  title="Delete saved chat">
                  {deleting === chat.chat_id
                    ? <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
