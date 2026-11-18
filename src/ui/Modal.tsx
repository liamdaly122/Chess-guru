import { useEffect, useRef, type ReactNode } from 'react'
import { CloseIcon } from './icons'

interface Props {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

/**
 * A dialog using the browser's <dialog> element: centred card on wide screens,
 * sheet from the bottom on phones. Escape and tapping the backdrop close it.
 */
export function Modal({ title, open, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="modal-card">
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        {open && children}
      </div>
    </dialog>
  )
}
