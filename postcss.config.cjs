// Use module.exports for maximum compatibility across different Node/PostCSS versions
module.exports = {
  plugins: [
    // CRITICAL FIX: Load plugins using 'require()' when using the array format.
    // This tells PostCSS to use the actual imported module, not just the string name.
    require('tailwindcss'),
    require('autoprefixer'),
  ],
}