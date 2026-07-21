'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  status: string
}

let cachedMembers: string[] | null = null

export function useTeamMembers() {
  const { toast } = useToast()
  const [members, setMembers] = useState<string[]>(cachedMembers ?? [])

  useEffect(() => {
    if (cachedMembers) return
    fetch('/api/team-members')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed')))
      .then((data: TeamMember[]) => {
        const names = data
          .filter(m => m.status === 'active' || m.status === 'Active')
          .map(m => m.name)
        cachedMembers = names
        setMembers(names)
      })
      .catch(() => {
        // AUDIT #265 — previously swallowed silently; the Account Manager
        // dropdown just looked empty with no indication anything failed.
        setMembers([])
        toast('Failed to load team members', 'error')
      })
  }, [toast])

  return members
}
