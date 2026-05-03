package com.noqueue.model;

public enum Role {
    STUDENT,
    PROFESSOR,
    HOD,
    VICE_PRINCIPAL,
    PRINCIPAL,
    DEAN,
    ADMIN;

    public int getPriority() {
        switch (this) {
            case PRINCIPAL:
            case DEAN:
            case VICE_PRINCIPAL:
                return 1;
            case HOD:
            case PROFESSOR:
                return 2;
            case STUDENT:
                return 3;
            default:
                return 4; // Admin or others
        }
    }
}
