@echo off
title Trucker DJ Player Server
cd /d "C:\Users\sereg\Documents\antigravity\hopeful-bell"
echo Starting Trucker DJ Player Local Server...
start "" "http://localhost:3080"
node server.js
pause
