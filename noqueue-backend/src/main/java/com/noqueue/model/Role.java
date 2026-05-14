package com.noqueue.model;

public enum Role {
    STUDENT,
    PROFESSOR,
    HOD,
    VICE_PRINCIPAL,
    PRINCIPAL,
    DEAN,
    ADMIN;

    /**
     * Legacy integer priority (lower = higher priority).
     * Kept for backwards-compat; new code should use {@link #getPriorityWeight()}.
     */
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
                return 4;
        }
    }

    /**
     * Hybrid-scheduler role weight.
     * Higher weight → lower effective score → claimed first.
     *
     * Formula:  effectiveScore = rolePriorityWeight
     *                           - (pages * 0.1)
     *                           - (waitingMinutes * 0.2)
     *
     * Lowest score wins (most urgent job is selected).
     */
    public int getPriorityWeight() {
        switch (this) {
            case PRINCIPAL:
            case DEAN:
            case VICE_PRINCIPAL:
                return 10;
            case HOD:
            case PROFESSOR:
                return 7;
            case STUDENT:
                return 3;
            default:
                return 1; // ADMIN or unknown – lowest scheduling weight
        }
    }
}
