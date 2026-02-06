/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './server/routes/emailRoutes.ts',
    ],
    safelist: [
        // Extract classes dynamically from template strings
        {
            pattern: /bg-|text-|p-|m-|w-|h-|flex|grid|border|rounded|shadow|space-|gap-|items-|justify-|leading-|tracking-|font-|opacity-|transition-|focus-|hover:|disabled:|peer-|ring-|max-w-|min-h-|overflow-|hidden|inline|whitespace-|shrink-|relative|absolute|fixed|sticky|top|bottom|left|right|z-|transform|scale|rotate|translate|skew/
        }
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                border: "hsl(20, 5.9%, 90%)",
                input: "hsl(20, 5.9%, 90%)",
                ring: "hsl(20, 14.3%, 4.1%)",
                background: "hsl(0, 0%, 100%)",
                foreground: "hsl(20, 14.3%, 4.1%)",
                primary: {
                    DEFAULT: "hsl(207, 90%, 54%)",
                    foreground: "hsl(211, 100%, 99%)",
                },
                secondary: {
                    DEFAULT: "hsl(60, 4.8%, 95.9%)",
                    foreground: "hsl(24, 9.8%, 10%)",
                },
                destructive: {
                    DEFAULT: "hsl(0, 84.2%, 60.2%)",
                    foreground: "hsl(60, 9.1%, 97.8%)",
                },
                muted: {
                    DEFAULT: "hsl(60, 4.8%, 95.9%)",
                    foreground: "hsl(25, 5.3%, 44.7%)",
                },
                accent: {
                    DEFAULT: "hsl(60, 4.8%, 95.9%)",
                    foreground: "hsl(24, 9.8%, 10%)",
                },
                popover: {
                    DEFAULT: "hsl(0, 0%, 100%)",
                    foreground: "hsl(20, 14.3%, 4.1%)",
                },
                card: {
                    DEFAULT: "hsl(0, 0%, 100%)",
                    foreground: "hsl(20, 14.3%, 4.1%)",
                },
            },
        }
    },
    plugins: [],
}
