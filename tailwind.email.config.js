/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './server/routes/emailRoutes.ts',
    ],
    safelist: [
        // Safelist all classes used in the email template
        'bg-slate-50', 'min-h-screen', 'flex', 'items-center', 'justify-center', 'p-4', 'text-slate-950',
        'bg-white', 'w-full', 'max-w-[480px]', 'rounded-xl', 'border', 'border-slate-200', 'shadow-sm',
        'overflow-hidden', 'p-6', 'pb-2', 'text-2xl', 'font-semibold', 'tracking-tight', 'text-sm',
        'text-slate-500', 'mt-1', 'pt-4', 'hidden', 'mb-6', 'bg-green-50', 'border-green-200',
        'text-green-800', 'rounded-lg', 'gap-2', 'font-medium', 'mb-1', 'text-green-700',
        'bg-slate-100', 'text-slate-800', 'leading-relaxed', 'text-slate-900', 'p-3', 'bg-amber-50',
        'border-amber-200', 'items-start', 'gap-3', 'w-4', 'h-4', 'text-amber-600', 'mt-0.5',
        'shrink-0', 'text-amber-900', 'mb-4', 'bg-red-50', 'text-red-600', 'border-red-200',
        'rounded-md', 'space-y-6', 'justify-between', 'space-x-4', 'space-y-0.5', 'leading-none',
        'peer-disabled:cursor-not-allowed', 'peer-disabled:opacity-70', 'text-[0.8rem]', 'h-px',
        'bg-slate-100', 'mt-8', 'space-y-4', 'inline-flex', 'whitespace-nowrap', 'ring-offset-white',
        'transition-colors', 'focus-visible:outline-none', 'focus-visible:ring-2',
        'focus-visible:ring-slate-950', 'focus-visible:ring-offset-2', 'disabled:pointer-events-none',
        'disabled:opacity-50', 'bg-slate-900', 'text-slate-50', 'hover:bg-slate-900/90', 'h-10',
        'px-4', 'py-2', 'text-red-500', 'hover:text-red-700', 'hover:bg-red-50', 'h-9',
        'animate-spin', '-ml-1', 'mr-2', 'opacity-25', 'opacity-75'
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
        }
    },
    plugins: [],
}
