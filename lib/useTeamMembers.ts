'use client'

import { useState, useEffect } from 'react'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  status: string
}

let cachedMembers: string[] | null = null

export function useTeamMembers() {
  const [members, setMembers] = useState<string[]>(cachedMembers ?? [])

  useEffect(() => {
    if (cachedMembers) return
    fetch('/api/team-members')
      .then(r => r.json())
      .then((data: TeamMember[]) => {
        const names = data.filter(m => m.status === 'Active').map(m => m.name)
        cachedMembers = names
        setMembers(names)
      })
      .catch(() => {
        // Fallback if fetch fails
        setMembers([])
      })
  }, [])

  return members
}
