import { defineStore } from 'pinia'

export const useFileStore = defineStore('file', () => {
  const fns: any = []

  const onmessage = (fn: any) => {
    fns.push(fn)
  }

  const send = (data: any) => {
    for (const fn of fns) {
      fn({data})
    }
  }

  return { send, onmessage}
})
