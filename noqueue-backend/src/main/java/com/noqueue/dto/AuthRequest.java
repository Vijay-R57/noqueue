package com.noqueue.dto;

import lombok.Data;

@Data
public class AuthRequest {
    private String email;
    private String password;
}
