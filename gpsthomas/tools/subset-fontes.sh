#!/bin/sh
# Gera as fontes Inter reduzidas (latim + pt-BR, woff2) em public/fonts. Requer: pip install fonttools brotli
for w in 400Regular 500Medium 600SemiBold 700Bold; do
  pyftsubset "node_modules/@expo-google-fonts/inter/$w/Inter_$w.ttf" \
    --unicodes="U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2030,U+2039-203A,U+20AC,U+2122,U+2190-2193,U+2212,U+00B0,U+00B2,U+00B3,U+00BA" \
    --layout-features='kern,liga,tnum,calt' --flavor=woff2 --output-file="public/fonts/Inter_$w.woff2"
done
