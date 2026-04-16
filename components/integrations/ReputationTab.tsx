'use client'

import { useEffect, useState, useCallback } from 'react'
import { useToast } from '@/components/ui/Toast'

interface ReviewReply {
  comment: string
  updateTime: string
}

interface Review {
  reviewId: string
  reviewer: { displayName: string }
  starRating: number
  comment: string
  createTime: string
  updateTime: string
  reviewReply?: ReviewReply
}

interface ReviewsResponse {
  reviews: Review[]
  totalReviewCount: number
  averageRating: number
  summary: { newReviews: number; averageRating: number; totalReviewCount: number }
}

interface Props {
  gbpLocationName?: string
  days?: number
}

function Stars({ rating, size = 'text-sm' }: { rating: number; size?: string }) {
  return (
    <span className={`inline-flex gap-px ${size}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? 'text-amber-500' : 'text-gray-300'}>
          {i < rating ? '★' : '☆'}
        </span>
      ))}
    </span>
  )
}

export default function ReputationTab({ gbpLocationName, days = 30 }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReviewsResponse | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  const fetchReviews = useCallback(async () => {
    if (!gbpLocationName) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        location: gbpLocationName,
        days: String(days),
        limit: '50',
      })
      const res = await fetch(`/api/integrations/gbp/reviews?${params}`)
      if (!res.ok) throw new Error('Failed to fetch reviews')
      setData(await res.json())
    } catch {
      toast('Failed to load reviews', 'error')
    } finally {
      setLoading(false)
    }
  }, [gbpLocationName, days, toast])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  if (!gbpLocationName) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-500">
        No Business Profile location configured
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
      </div>
    )
  }

  async function sendReply(reviewId: string) {
    setSending(true)
    try {
      const res = await fetch('/api/integrations/gbp/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: gbpLocationName, reviewId, comment: replyText }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to send reply' }))
        throw new Error(err.error || 'Failed to send reply')
      }
      toast('Reply sent', 'success')
      setReplyingTo(null)
      setReplyText('')
      fetchReviews()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to send reply', 'error')
    } finally {
      setSending(false)
    }
  }

  const summary = data?.summary
  const reviews = data?.reviews ?? []

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{summary.averageRating.toFixed(1)}</p>
            <Stars rating={Math.round(summary.averageRating)} size="text-lg" />
            <p className="text-[11px] text-gray-500 mt-1 uppercase tracking-wide font-semibold">Avg Rating</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{summary.totalReviewCount}</p>
            <p className="text-[11px] text-gray-500 mt-1 uppercase tracking-wide font-semibold">Total Reviews</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{summary.newReviews}</p>
            <p className="text-[11px] text-gray-500 mt-1 uppercase tracking-wide font-semibold">New This Period</p>
          </div>
        </div>
      )}

      {/* Reviews list */}
      <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
        {reviews.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">No reviews found for this period.</p>
        )}
        {reviews.map((review) => (
          <div key={review.reviewId} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Stars rating={review.starRating} />
                <span className="text-sm font-semibold text-gray-800">{review.reviewer.displayName}</span>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(review.createTime).toLocaleDateString()}
              </span>
            </div>

            {review.comment && (
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{review.comment}</p>
            )}

            {/* Existing reply */}
            {review.reviewReply && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-xs font-semibold text-emerald-800 mb-1">Your Reply</p>
                <p className="text-sm text-emerald-900 whitespace-pre-line">{review.reviewReply.comment}</p>
                <p className="text-[10px] text-emerald-600 mt-1">
                  {new Date(review.reviewReply.updateTime).toLocaleDateString()}
                </p>
              </div>
            )}

            {/* Reply action */}
            {!review.reviewReply && replyingTo !== review.reviewId && (
              <button
                onClick={() => { setReplyingTo(review.reviewId); setReplyText('') }}
                className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-900"
              >
                Reply
              </button>
            )}

            {/* Inline reply form */}
            {replyingTo === review.reviewId && (
              <div className="mt-3 flex flex-col gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write your reply..."
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => sendReply(review.reviewId)}
                    disabled={sending || !replyText.trim()}
                    className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-50 hover:opacity-90"
                    style={{ background: '#015035' }}
                  >
                    {sending ? 'Sending...' : 'Send Reply'}
                  </button>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
