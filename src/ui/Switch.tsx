interface Props {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** An on/off switch with a label, built on a real checkbox so it works with keyboards and screen readers. */
export function Switch({ label, description, checked, onChange }: Props) {
  return (
    <label className="switch-row">
      <span className="switch-text">
        <span className="switch-label">{label}</span>
        {description && <span className="switch-desc">{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden>
        <span className="switch-thumb" />
      </span>
    </label>
  )
}
