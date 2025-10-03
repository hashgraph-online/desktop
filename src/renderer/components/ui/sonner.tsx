import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: 'group-[.toaster]:text-foreground group-[.toaster]:bg-background group-[.toaster]:border-border',
          description: 'group-[.toaster]:text-muted-foreground',
          actionButton: 'group-[.toaster]:bg-primary group-[.toaster]:text-primary-foreground',
          cancelButton: 'group-[.toaster]:bg-muted group-[.toaster]:text-muted-foreground',
        },
      }}
      closeButton
      richColors
      expand={false}
      position="bottom-right"
      duration={5000}
      visibleToasts={3}
      dir="ltr"
      gap={8}
      {...props}
    />
  )
}

export { Toaster }
