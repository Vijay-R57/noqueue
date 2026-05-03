package com.noqueue.dto;

import com.noqueue.model.Role;
import lombok.Data;

@Data
public class SignupRequest {
    private String email;
    private String password;
    private Role role;
}
