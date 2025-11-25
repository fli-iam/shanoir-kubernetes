// Shanoir NG Configuration Template

// Copy this file to config.ts and customize for your deployment
export interface ShanoirConfig {
  // Domain configuration
  domain: string;
  ohifDomain: string;
  vipDomain: string;

  // TLS configuration
  enableTLS: boolean;
  certificatePem: string; // base64 encoded
  certificateKey: string; // base64 encoded

  // Database credentials
  database: {
    rootPassword: string;
    password: string;
    user: string;
  };

  // Keycloak configuration
  keycloak: {
    adminUser: string;
    adminPassword: string;
  };

  // SMTP configuration
  smtp: {
    host: string;
  };

  // Admin configuration
  admin: {
    email: string;
    name: string;
    allowedIPs: string;
  };

  // VIP integration
  vip: {
    clientSecret: string;
    serviceEmail: string;
  };

  // Storage configuration
  storage: {
    databaseSize: string;
    dataSize: string;
    logSize: string;
  };

  // Instance branding
  instance: {
    name: string;
    color: string;
  };
}

// Default configuration - CUSTOMIZE THIS
export const defaultConfig: ShanoirConfig = {
  domain: "shanoir.example.com",
  ohifDomain: "ohif.example.com",
  vipDomain: "vip.example.com",

  enableTLS: true,
  certificatePem: "base64-encoded-cert",
  certificateKey: "base64-encoded-key",

  database: {
    rootPassword: "change-me-root-password",
    password: "change-me-password",
    user: "shanoir",
  },

  keycloak: {
    adminUser: "admin",
    adminPassword: "change-me-admin-password",
  },

  smtp: {
    host: "smtp.example.com",
  },

  admin: {
    email: "admin@example.com",
    name: "Shanoir Administrator",
    allowedIPs: "0.0.0.0/0", // Restrict this in production
  },

  vip: {
    clientSecret: "change-me-vip-secret",
    serviceEmail: "vip@example.com",
  },

  storage: {
    databaseSize: "20Gi",
    dataSize: "50Gi",
    logSize: "5Gi",
  },

  instance: {
    name: "Shanoir NG",
    color: "#1f4e79",
  },
};

// DCM4CHEE configuration (add these to your environment variables)
export const dcm4cheeEnv = {
  // LDAP Configuration
  LDAP_URL: "ldap://ldap:389",
  LDAP_BASEDN: "dc=dcm4chee,dc=org",
  LDAP_CONFIGDN: "cn=config",
  LDAP_ROOTPASS: "change-me-ldap-password",

  // PostgreSQL Configuration
  POSTGRES_DB: "dcm4chee",
  POSTGRES_USER: "dcm4chee",
  POSTGRES_PASSWORD: "change-me-postgres-password",

  // DCM4CHEE Arc Configuration
  POSTGRES_HOST: "dcm4chee-database",
  POSTGRES_PORT: "5432",
  WILDFLY_ADMIN_USER: "admin",
  WILDFLY_ADMIN_PASSWORD: "change-me-wildfly-password",
};

// Database environment variables (add these to ConfigMap)
export const databaseEnv = {
  MYSQL_ROOT_PASSWORD: "change-me-root-password",
  MYSQL_DATABASE: "shanoir_ng",
  MYSQL_USER: "shanoir",
  MYSQL_PASSWORD: "change-me-password",

  // Performance tuning
  MYSQL_INNODB_BUFFER_POOL_SIZE: "1G",
  MYSQL_INNODB_LOG_FILE_SIZE: "256M",
  MYSQL_MAX_CONNECTIONS: "200",
};
