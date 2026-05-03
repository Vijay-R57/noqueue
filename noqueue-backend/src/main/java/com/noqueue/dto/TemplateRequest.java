package com.noqueue.dto;

import com.noqueue.model.TemplateType;
import lombok.Data;

@Data
public class TemplateRequest {
    private String name;
    private TemplateType type;
    private String fileUrl;
    private String configData;
}
