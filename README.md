# Notation Lookup (Scientific ↔ Abbreviation)

A static website that:

- Loads `numbers.txt` (your mapping list)
- Lets people search abbreviations or scientific notation
- Shows both counterparts in a table
- Includes a calculator to compare two values (ratio + exponent gap)

## GitHub Pages deploy (no build tools)

1. Create a new GitHub repo
2. Upload **all files** from this folder:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `numbers.txt`
3. In GitHub: **Settings → Pages**
   - Source: `Deploy from a branch`
   - Branch: `main` (or `master`) / root
4. Your site will be live at your GitHub Pages URL.

## Data format

Each line in `numbers.txt` should look like:

```
1QaD = 1e45
```

Blank lines are ignored. Lines starting with `#` are treated as comments.

## Notes

- This site runs entirely in the browser (no server).
- For huge values, the calculator reports results as a coefficient and a base-10 exponent.
