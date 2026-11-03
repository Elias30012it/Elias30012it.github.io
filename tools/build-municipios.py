"""Gera js/municipios.js (busca de cidades no site) a partir de data/municipios.csv.

Fonte: github.com/kelvins/municipios-brasileiros (MIT), baseada nos dados do IBGE.
Uso: python3 tools/build-municipios.py > js/municipios.js
"""
import csv
import json

rows = list(csv.DictReader(open("data/municipios.csv", encoding="utf-8")))
packed = ";".join(f'{r["nome"]}|{r["uf"]}|{float(r["latitude"]):.3f}|{float(r["longitude"]):.3f}|{r["capital"]}' for r in rows)
print("// Gerado por tools/build-municipios.py — dados do IBGE via kelvins/municipios-brasileiros (MIT).")
print("// Formato: nome|UF|lat|lng|capital(1/0), separados por ';'.")
print("window.MUNICIPIOS = " + json.dumps(packed, ensure_ascii=False) + ";")
