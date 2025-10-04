package com.example.chat;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.ResponseEntity;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
public class UploadController {
    private static final String UPLOAD_DIR = "uploads";

    @PostMapping("/upload")
    public ResponseEntity<String> uploadFile(@RequestParam("file") MultipartFile file) throws Exception {
        File dir = new File(UPLOAD_DIR);
        if (!dir.exists()) dir.mkdirs();
        String filename = System.currentTimeMillis() + "_" + file.getOriginalFilename();
        Path filepath = Paths.get(UPLOAD_DIR, filename);
        Files.write(filepath, file.getBytes());
        return ResponseEntity.ok("/uploads/" + filename);
    }
}
