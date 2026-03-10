import { supabase } from './supabase'
import type { CRMContact, CRMCompany, Deal } from './types'

/* =========================
   CONTACTS
========================= */

export async function getContacts(): Promise<CRMContact[]> {
  const { data, error } = await supabase
    .from('crm_contacts')
    .select('*')
    .order('createdDate', { ascending: false })

  if (error) {
    console.error('Error loading contacts', error)
    return []
  }

  return data as CRMContact[]
}

export async function createContact(contact: Partial<CRMContact>) {
  const { data, error } = await supabase
    .from('crm_contacts')
    .insert(contact)
    .select()

  if (error) throw error

  return data
}

export async function updateContact(id: string, updates: Partial<CRMContact>) {
  const { error } = await supabase
    .from('crm_contacts')
    .update(updates)
    .eq('id', id)

  if (error) throw error
}

export async function deleteContact(id: string) {
  const { error } = await supabase
    .from('crm_contacts')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/* =========================
   COMPANIES
========================= */

export async function getCompanies(): Promise<CRMCompany[]> {
  const { data, error } = await supabase
    .from('crm_companies')
    .select('*')
    .order('createdDate', { ascending: false })

  if (error) {
    console.error(error)
    return []
  }

  return data as CRMCompany[]
}

export async function createCompany(company: Partial<CRMCompany>) {
  const { data, error } = await supabase
    .from('crm_companies')
    .insert(company)
    .select()

  if (error) throw error

  return data
}

export async function updateCompany(id: string, updates: Partial<CRMCompany>) {
  const { error } = await supabase
    .from('crm_companies')
    .update(updates)
    .eq('id', id)

  if (error) throw error
}

/* =========================
   DEALS
========================= */

export async function getDeals(): Promise<Deal[]> {
  const { data, error } = await supabase
    .from('crm_deals')
    .select('*')
    .order('closeDate', { ascending: false })

  if (error) {
    console.error(error)
    return []
  }

  return data as Deal[]
}

export async function createDeal(deal: Partial<Deal>) {
  const { data, error } = await supabase
    .from('crm_deals')
    .insert(deal)
    .select()

  if (error) throw error

  return data
}

export async function updateDeal(id: string, updates: Partial<Deal>) {
  const { error } = await supabase
    .from('crm_deals')
    .update(updates)
    .eq('id', id)

  if (error) throw error
}

export async function deleteDeal(id: string) {
  const { error } = await supabase
    .from('crm_deals')
    .delete()
    .eq('id', id)

  if (error) throw error
}
