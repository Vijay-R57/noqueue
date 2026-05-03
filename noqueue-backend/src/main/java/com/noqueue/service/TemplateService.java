package com.noqueue.service;

import com.noqueue.dto.TemplateRequest;
import com.noqueue.model.Template;
import com.noqueue.repository.TemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TemplateService {

    private final TemplateRepository templateRepository;

    public Template createTemplate(TemplateRequest request) {
        Template template = Template.builder()
                .name(request.getName())
                .type(request.getType())
                .fileUrl(request.getFileUrl())
                .configData(request.getConfigData())
                .build();
        return templateRepository.save(template);
    }
}
