type ButtonProps = {
  active?: boolean
  className?: string
  children: React.ReactNode
} & (
  | (React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string })
  | React.ButtonHTMLAttributes<HTMLButtonElement>
)

export function Button({ active = false, className = '', children, ...props }: ButtonProps) {
  const classes = `btn ${active ? 'btn-active' : 'btn-inactive'} ${className}`.trim()

  if ('href' in props) {
    return (
      <a className={classes} {...props}>
        {children}
      </a>
    )
  }

  return (
    <button className={classes} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  )
}
