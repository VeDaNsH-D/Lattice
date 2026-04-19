/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    safelist: [
        'bg-gradient-to-br',
        'from-fuchsia-600', 'via-purple-500', 'to-indigo-500',
        'from-sky-500', 'via-cyan-400', 'to-emerald-400',
        'from-rose-500', 'via-orange-500', 'to-amber-400',
        'from-emerald-500', 'via-lime-400', 'to-yellow-300',
        'from-gray-200', 'via-gray-100', 'to-white'
    ],
    theme: {
        extend: {},
    },
    plugins: [],
};
