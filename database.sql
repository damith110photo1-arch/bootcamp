-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS `technavigators`;
USE `technavigators`;

-- Create the users table
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the interviews table
CREATE TABLE IF NOT EXISTS `interviews` (
    `id` VARCHAR(100) PRIMARY KEY,
    `user_id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `date` DATE NOT NULL,
    `time` TIME NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `notes` TEXT,
    `room_name` VARCHAR(255) NOT NULL,
    `jitsi_link` VARCHAR(255) NOT NULL,
    `status` VARCHAR(50) DEFAULT 'upcoming',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
