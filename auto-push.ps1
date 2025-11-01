cd "D:\manjano-functions"

# Stage all changes
git add .

# Commit with date-time as message
 = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
git commit -m "Auto-commit "

# Push to GitHub
git push origin main
