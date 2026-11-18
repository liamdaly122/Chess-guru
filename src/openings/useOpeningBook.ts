import { useEffect, useMemo, useState } from 'react'
import { bookStatus, loadBook, type BookData, type BookStatus } from './book'

/** Book status for a game's positions. null until the opening table has loaded. */
export function useOpeningBook(positions: string[]): { book: BookData; status: BookStatus } | null {
  const [book, setBook] = useState<BookData | null>(null)
  useEffect(() => {
    let live = true
    loadBook().then((b) => live && setBook(b))
    return () => {
      live = false
    }
  }, [])
  return useMemo(() => (book ? { book, status: bookStatus(book, positions) } : null), [book, positions])
}
