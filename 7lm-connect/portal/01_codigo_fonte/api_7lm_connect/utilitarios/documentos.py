"""
Utilitarios para documentos brasileiros (CPF/CEP/telefone).
"""

from __future__ import annotations

from typing import Any


def somente_digitos(valor: Any) -> str:
    return "".join(ch for ch in str(valor or "") if ch.isdigit())


def normalizar_cpf(valor: Any) -> str | None:
    cpf = somente_digitos(valor)
    if not cpf:
        return None
    return cpf[:11]


def cpf_valido(valor: Any) -> bool:
    cpf = normalizar_cpf(valor)
    if not cpf or len(cpf) != 11:
        return False

    if cpf == cpf[0] * 11:
        return False

    soma = sum(int(cpf[indice]) * (10 - indice) for indice in range(9))
    digito_1 = (soma * 10) % 11
    digito_1 = 0 if digito_1 == 10 else digito_1
    if digito_1 != int(cpf[9]):
        return False

    soma = sum(int(cpf[indice]) * (11 - indice) for indice in range(10))
    digito_2 = (soma * 10) % 11
    digito_2 = 0 if digito_2 == 10 else digito_2
    return digito_2 == int(cpf[10])


def normalizar_cep(valor: Any) -> str | None:
    cep = somente_digitos(valor)
    if not cep:
        return None
    return cep[:8]
