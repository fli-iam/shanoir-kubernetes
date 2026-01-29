import { Construct } from "constructs";
import { App, Chart, ChartProps } from "cdk8s";
import {
  KubeNamespace,
  KubeConfigMap,
  KubeSecret,
  KubePersistentVolumeClaim,
  KubeDeployment,
  KubeService,
  KubeIngress,
  IntOrString,
  EnvVar,
  Volume,
  VolumeMount,
  Quantity,
} from "./imports/k8s";

export class ShanoirNGChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    // Create namespace
    new KubeNamespace(this, "shanoir-namespace", {
      metadata: {
        name: "shanoir-ng",
        labels: {
          project: "shanoir-dev",
        },
      },
    });

    // Create ConfigMaps for environment variables
    new KubeConfigMap(this, "shanoir-config", {
      metadata: {
        name: "shanoir-config",
        namespace: "shanoir-ng",
      },
      data: {
        SHANOIR_PREFIX: "",
        SHANOIR_URL_SCHEME: "https",
        SHANOIR_URL_HOST: "shanoir-dev.cibm.ch",
        SHANOIR_VIEWER_OHIF_URL_SCHEME: "https",
        SHANOIR_VIEWER_OHIF_URL_HOST: "viewer",
        SHANOIR_SMTP_HOST: "localhost",
        SHANOIR_MIGRATION: "auto",
        SHANOIR_ADMIN_EMAIL: "shanoir.admin@inria.fr",
        SHANOIR_ADMIN_NAME: "shanoir admin",
        SHANOIR_ALLOWED_ADMIN_IPS: "",
        SHANOIR_X_FORWARDED: "generate",
        SHANOIR_INSTANCE_NAME: "",
        SHANOIR_INSTANCE_COLOR: "",
        SHANOIR_KEYCLOAK_ADAPTER_MODE: "check-sso",
        SHANOIR_CERTIFICATE: "auto",
        SHANOIR_CERTIFICATE_PEM_CRT: "none",
        SHANOIR_CERTIFICATE_PEM_KEY: "none",
        VIP_URL_SCHEME: "https",
        VIP_URL_HOST: "vip.creatis.insa-lyon.fr",
        VIP_SERVICE_EMAIL: "",
      },
    });

    // Create Secrets for sensitive data
    new KubeSecret(this, "shanoir-secrets", {
      metadata: {
        name: "shanoir-secrets",
        namespace: "shanoir-ng",
      },
      stringData: {
        SHANOIR_KEYCLOAK_USER: "admin",
        SHANOIR_KEYCLOAK_PASSWORD: "&a1A&a1A",
        VIP_CLIENT_SECRET: "SECRET",
        MYSQL_DATABASE: "keycloak",
        MYSQL_ROOT_PASSWORD: "root123",
        MYSQL_PASSWORD: "mysql123",
        MYSQL_USER: "mysql",
      },
    });

    // Create PersistentVolumeClaims for data persistence
    const persistentVolumes = [
      "keycloak-database-data",
      "rabbitmq-data",
      "database-data",
      "datasets-data",
      "extra-data",
      "studies-data",
      "dcm4chee-ldap-data",
      "dcm4chee-sldap-data",
      "dcm4chee-database-data",
      "dcm4chee-arc-wildfly-data",
      "dcm4chee-arc-storage-data",
      "solr-data",
      "certificate-share-data",
      "tmp",
      "logs",
      "keycloak-logs",
    ];

    persistentVolumes.forEach((volumeName) => {
      new KubePersistentVolumeClaim(this, `${volumeName}-pvc`, {
        metadata: {
          name: `${volumeName}-pvc`,
          namespace: "shanoir-ng",
        },
        spec: {
          accessModes: ["ReadWriteOnce"],
          resources: {
            requests: {
              storage: Quantity.fromString(
                volumeName.includes("database") || volumeName.includes("data")
                  ? "20Gi"
                  : "5Gi"
              ),
            },
          },
        },
      });
    });

    // Helper function to create common environment variables
    const getCommonEnvVars = (): EnvVar[] => [
      {
        name: "SHANOIR_PREFIX",
        valueFrom: {
          configMapKeyRef: { name: "shanoir-config", key: "SHANOIR_PREFIX" },
        },
      },
      {
        name: "SHANOIR_URL_SCHEME",
        valueFrom: {
          configMapKeyRef: {
            name: "shanoir-config",
            key: "SHANOIR_URL_SCHEME",
          },
        },
      },
      {
        name: "SHANOIR_URL_HOST",
        valueFrom: {
          configMapKeyRef: { name: "shanoir-config", key: "SHANOIR_URL_HOST" },
        },
      },
      {
        name: "SHANOIR_MIGRATION",
        valueFrom: {
          configMapKeyRef: { name: "shanoir-config", key: "SHANOIR_MIGRATION" },
        },
      },
    ];

    // Keycloak Database
    new KubeDeployment(this, "keycloak-database", {
      metadata: {
        name: "keycloak-database",
        namespace: "shanoir-ng",
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: "keycloak-database" } },
        template: {
          metadata: { labels: { app: "keycloak-database" } },
          spec: {
            containers: [
              {
                name: "keycloak-database",
                image: "ghcr.io/fli-iam/shanoir-ng/keycloak-database:NG_v2.7.5",
                args: ["--ignore-db-dir=lost+found"],
                env: [
                  {
                    name: "MYSQL_DATABASE",
                    valueFrom: {
                      secretKeyRef: {
                        name: "shanoir-secrets",
                        key: "MYSQL_DATABASE",
                      },
                    },
                  },
                ],
                ports: [{ containerPort: 3306 }],
                volumeMounts: [
                  {
                    name: "keycloak-database-data",
                    mountPath: "/var/lib/mysql",
                  },
                ],
              },
            ],
            volumes: [
              {
                name: "keycloak-database-data",
                persistentVolumeClaim: {
                  claimName: "keycloak-database-data-pvc",
                },
              },
            ],
          },
        },
      },
    });

    new KubeService(this, "keycloak-database-service", {
      metadata: {
        name: "keycloak-database",
        namespace: "shanoir-ng",
      },
      spec: {
        selector: { app: "keycloak-database" },
        ports: [{ port: 3306, targetPort: IntOrString.fromNumber(3306) }],
      },
    });

    // Keycloak
    new KubeDeployment(this, "keycloak", {
      metadata: {
        name: "keycloak",
        namespace: "shanoir-ng",
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: "keycloak" } },
        template: {
          metadata: { labels: { app: "keycloak" } },
          spec: {
            containers: [
              {
                name: "keycloak",
                image: "ghcr.io/fli-iam/shanoir-ng/keycloak:NG_v2.7.5",
                env: [
                  ...getCommonEnvVars(),

                  {
                    name: "SHANOIR_ADMIN_EMAIL",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_ADMIN_EMAIL",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_SMTP_HOST",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_SMTP_HOST",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_VIEWER_OHIF_URL_SCHEME",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_VIEWER_OHIF_URL_SCHEME",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_VIEWER_OHIF_URL_HOST",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_VIEWER_OHIF_URL_HOST",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_ADMIN_NAME",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_ADMIN_NAME",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_KEYCLOAK_USER",
                    valueFrom: {
                      secretKeyRef: {
                        name: "shanoir-secrets",
                        key: "SHANOIR_KEYCLOAK_USER",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_KEYCLOAK_PASSWORD",
                    valueFrom: {
                      secretKeyRef: {
                        name: "shanoir-secrets",
                        key: "SHANOIR_KEYCLOAK_PASSWORD",
                      },
                    },
                  },
                ],
                ports: [{ containerPort: 8080 }],
                volumeMounts: [
                  {
                    name: "keycloak-logs",
                    mountPath: "/opt/keycloak/data/log",
                  },
                ],
              },
            ],
            volumes: [
              {
                name: "keycloak-logs",
                persistentVolumeClaim: { claimName: "keycloak-logs-pvc" },
              },
            ],
          },
        },
      },
    });

    new KubeService(this, "keycloak-service", {
      metadata: {
        name: "keycloak",
        namespace: "shanoir-ng",
      },
      spec: {
        selector: { app: "keycloak" },
        ports: [{ port: 8080, targetPort: IntOrString.fromNumber(8080) }],
      },
    });

    // RabbitMQ
    new KubeDeployment(this, "rabbitmq", {
      metadata: {
        name: "rabbitmq",
        namespace: "shanoir-ng",
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: "rabbitmq" } },
        template: {
          metadata: { labels: { app: "rabbitmq" } },
          spec: {
            containers: [
              {
                name: "rabbitmq",
                image: "rabbitmq:3.10.7",
                ports: [{ containerPort: 5672 }, { containerPort: 15672 }],
                volumeMounts: [
                  {
                    name: "rabbitmq-data",
                    mountPath: "/var/lib/rabbitmq/mnesia/rabbitmq",
                  },
                ],
              },
            ],
            volumes: [
              {
                name: "rabbitmq-data",
                persistentVolumeClaim: { claimName: "rabbitmq-data-pvc" },
              },
            ],
          },
        },
      },
    });

    new KubeService(this, "rabbitmq-service", {
      metadata: {
        name: "rabbitmq",
        namespace: "shanoir-ng",
      },
      spec: {
        selector: { app: "rabbitmq" },
        ports: [
          {
            name: "amqp",
            port: 5672,
            targetPort: IntOrString.fromNumber(5672),
          },
          {
            name: "management",
            port: 15672,
            targetPort: IntOrString.fromNumber(15672),
          },
        ],
      },
    });

    // Main Database
    new KubeDeployment(this, "database", {
      metadata: {
        name: "database",
        namespace: "shanoir-ng",
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: "database" } },
        template: {
          metadata: { labels: { app: "database" } },
          spec: {
            containers: [
              {
                name: "database",
                image: "ghcr.io/fli-iam/shanoir-ng/database:NG_v2.7.5",
                // command: ["/bin/sh", "-c"],
                args: [
                  "--max_allowed_packet",
                  "20000000",
                  "--ignore-db-dir=lost+found", // Fix k8s and old mysql https://stackoverflow.com/questions/37644118/initializing-mysql-directory-error
                ],
                env: [
                  {
                    name: "SHANOIR_MIGRATION",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_MIGRATION",
                      },
                    },
                  },
                  {
                    name: "MYSQL_ROOT_PASSWORD",
                    value: "password",
                  },
                ],
                ports: [{ containerPort: 3306 }],
                volumeMounts: [
                  {
                    name: "database-data",
                    mountPath: "/var/lib/mysql",
                  },
                ],
              },
            ],
            volumes: [
              {
                name: "database-data",
                persistentVolumeClaim: { claimName: "database-data-pvc" },
              },
            ],
          },
        },
      },
    });

    new KubeService(this, "database-service", {
      metadata: {
        name: "database",
        namespace: "shanoir-ng",
      },
      spec: {
        selector: { app: "database" },
        ports: [{ port: 3306, targetPort: IntOrString.fromNumber(3306) }],
      },
    });

    // Helper function to create microservice deployments
    const createMicroservice = (
      name: string,
      port: number,
      debugPort: number,
      additionalEnv: EnvVar[] = [],
      additionalVolumes: { name: string; mountPath: string }[] = []
    ) => {
      const volumeMounts: VolumeMount[] = [
        { name: "logs", mountPath: "/var/log/shanoir-ng-logs" },
        {
          name: "certificate-share-data",
          mountPath: "/etc/ssl/certs/java",
          readOnly: true,
        },
        ...additionalVolumes.map((vol) => ({
          name: vol.name,
          mountPath: vol.mountPath,
        })),
      ];

      const volumes: Volume[] = [
        { name: "logs", persistentVolumeClaim: { claimName: "logs-pvc" } },
        {
          name: "certificate-share-data",
          persistentVolumeClaim: { claimName: "certificate-share-data-pvc" },
        },
        ...additionalVolumes.map((vol) => ({
          name: vol.name,
          // Use emptyDir for tmp volumes, PVC for others
          ...(vol.name === "tmp"
            ? { emptyDir: {} }
            : { persistentVolumeClaim: { claimName: `${vol.name}-pvc` } }),
        })),
      ];

      new KubeDeployment(this, name, {
        metadata: {
          name: name,
          namespace: "shanoir-ng",
        },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: name } },
          template: {
            metadata: { labels: { app: name, project: "shanoir-dev" } },
            spec: {
              affinity: {
                podAffinity: {
                  preferredDuringSchedulingIgnoredDuringExecution: [
                    {
                      weight: 100,
                      podAffinityTerm: {
                        labelSelector: {
                          matchExpressions: [
                            {
                              key: "project",
                              operator: "In",
                              values: ["shanoir-dev"],
                            },
                          ],
                        },
                        topologyKey: "kubernetes.io/hostname",
                      },
                    },
                  ],
                },
              },
              containers: [
                {
                  name: name,
                  image: `ghcr.io/fli-iam/shanoir-ng/${name}:NG_v2.7.5`,
                  env: [...getCommonEnvVars(), ...additionalEnv],
                  ports: [
                    { containerPort: port },
                    { containerPort: debugPort },
                  ],
                  volumeMounts: volumeMounts,
                },
              ],
              volumes: volumes,
            },
          },
        },
      });

      new KubeService(this, `${name}-service`, {
        metadata: {
          name: name,
          namespace: "shanoir-ng",
        },
        spec: {
          selector: { app: name },
          ports: [
            {
              name: "http",
              port: port,
              targetPort: IntOrString.fromNumber(port),
            },
            {
              name: "debug",
              port: debugPort,
              targetPort: IntOrString.fromNumber(debugPort),
            },
          ],
        },
      });
    };

    // Users microservice
    createMicroservice("users", 9901, 9911, [
      {
        name: "SHANOIR_SMTP_HOST",
        valueFrom: {
          configMapKeyRef: { name: "shanoir-config", key: "SHANOIR_SMTP_HOST" },
        },
      },
      {
        name: "SHANOIR_ADMIN_EMAIL",
        valueFrom: {
          configMapKeyRef: {
            name: "shanoir-config",
            key: "SHANOIR_ADMIN_EMAIL",
          },
        },
      },
      {
        name: "SHANOIR_KEYCLOAK_USER",
        valueFrom: {
          secretKeyRef: {
            name: "shanoir-secrets",
            key: "SHANOIR_KEYCLOAK_USER",
          },
        },
      },
      {
        name: "SHANOIR_KEYCLOAK_PASSWORD",
        valueFrom: {
          secretKeyRef: {
            name: "shanoir-secrets",
            key: "SHANOIR_KEYCLOAK_PASSWORD",
          },
        },
      },
      {
        name: "VIP_SERVICE_EMAIL",
        valueFrom: {
          configMapKeyRef: { name: "shanoir-config", key: "VIP_SERVICE_EMAIL" },
        },
      },
      {
        name: "SHANOIR_CERTIFICATE_PEM_CRT",
        valueFrom: {
          configMapKeyRef: {
            name: "shanoir-config",
            key: "SHANOIR_CERTIFICATE_PEM_CRT",
          },
        },
      },
      {
        name: "SHANOIR_CERTIFICATE_PEM_KEY",
        valueFrom: {
          configMapKeyRef: {
            name: "shanoir-config",
            key: "SHANOIR_CERTIFICATE_PEM_KEY",
          },
        },
      },
    ]);

    // Studies microservice
    createMicroservice(
      "studies",
      9902,
      9912,
      [],
      [
        { name: "studies-data", mountPath: "/var/studies-data" },
        { name: "tmp", mountPath: "/tmp" },
      ]
    );

    // Import microservice
    createMicroservice(
      "import",
      9903,
      9913,
      [],
      [{ name: "tmp", mountPath: "/tmp" }]
    );

    // Datasets microservice
    createMicroservice(
      "datasets",
      9904,
      9914,
      [
        {
          name: "SHANOIR_VIEWER_OHIF_URL_SCHEME",
          valueFrom: {
            configMapKeyRef: {
              name: "shanoir-config",
              key: "SHANOIR_VIEWER_OHIF_URL_SCHEME",
            },
          },
        },
        {
          name: "SHANOIR_VIEWER_OHIF_URL_HOST",
          valueFrom: {
            configMapKeyRef: {
              name: "shanoir-config",
              key: "SHANOIR_VIEWER_OHIF_URL_HOST",
            },
          },
        },
        {
          name: "VIP_URL_SCHEME",
          valueFrom: {
            configMapKeyRef: { name: "shanoir-config", key: "VIP_URL_SCHEME" },
          },
        },
        {
          name: "VIP_URL_HOST",
          valueFrom: {
            configMapKeyRef: { name: "shanoir-config", key: "VIP_URL_HOST" },
          },
        },
        {
          name: "VIP_CLIENT_SECRET",
          valueFrom: {
            secretKeyRef: { name: "shanoir-secrets", key: "VIP_CLIENT_SECRET" },
          },
        },
      ],
      [
        { name: "tmp", mountPath: "/tmp" },
        { name: "datasets-data", mountPath: "/var/datasets-data" },
      ]
    );

    // Preclinical microservice
    createMicroservice(
      "preclinical",
      9905,
      9915,
      [],
      [
        { name: "tmp", mountPath: "/tmp" },
        { name: "extra-data", mountPath: "/var/extra-data" },
      ]
    );

    // Nifti Conversion microservice
    new KubeDeployment(this, "nifti-conversion", {
      metadata: {
        name: "nifti-conversion",
        namespace: "shanoir-ng",
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: "nifti-conversion" } },
        template: {
          metadata: {
            labels: { app: "nifti-conversion", project: "shanoir-dev" },
          },
          spec: {
            affinity: {
              podAffinity: {
                preferredDuringSchedulingIgnoredDuringExecution: [
                  {
                    weight: 100,
                    podAffinityTerm: {
                      labelSelector: {
                        matchExpressions: [
                          {
                            key: "project",
                            operator: "In",
                            values: ["shanoir-dev"],
                          },
                        ],
                      },
                      topologyKey: "kubernetes.io/hostname",
                    },
                  },
                ],
              },
            },
            containers: [
              {
                name: "nifti-conversion",
                image: "ghcr.io/fli-iam/shanoir-ng/nifti-conversion:NG_v2.7.5",
                env: getCommonEnvVars(),
                volumeMounts: [
                  { name: "logs", mountPath: "/var/log/shanoir-ng-logs" },
                  { name: "datasets-data", mountPath: "/var/datasets-data" },
                  { name: "tmp", mountPath: "/tmp" },
                ],
              },
            ],
            volumes: [
              {
                name: "logs",
                persistentVolumeClaim: { claimName: "logs-pvc" },
              },
              {
                name: "datasets-data",
                persistentVolumeClaim: { claimName: "datasets-data-pvc" },
              },
              { name: "tmp", emptyDir: {} },
            ],
          },
        },
      },
    });

    // Solr
    new KubeDeployment(this, "solr", {
      metadata: {
        name: "solr",
        namespace: "shanoir-ng",
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: "solr" } },
        template: {
          metadata: { labels: { app: "solr" } },
          spec: {
            securityContext: {
              fsGroup: 8983,
              runAsUser: 8983,
              runAsGroup: 8983,
            },
            containers: [
              {
                name: "solr",
                image: "ghcr.io/fli-iam/shanoir-ng/solr:NG_v2.7.5",
                env: [
                  { name: "SOLR_LOG_LEVEL", value: "SEVERE" },
                  { name: "RMI_PORT", value: "8983" },
                  { name: "SOLR_PORT", value: "8984" },
                  { name: "SOLR_JETTY_HOST", value: "0.0.0.0" },
                ],
                ports: [{ containerPort: 8983 }],
                volumeMounts: [
                  {
                    name: "solr-data",
                    mountPath: "/var/solr",
                  },
                ],
              },
            ],
            volumes: [
              {
                name: "solr-data",
                persistentVolumeClaim: { claimName: "solr-data-pvc" },
              },
            ],
          },
        },
      },
    });

    new KubeService(this, "solr-service", {
      metadata: {
        name: "solr",
        namespace: "shanoir-ng",
      },
      spec: {
        selector: { app: "solr" },
        ports: [{ port: 8983, targetPort: IntOrString.fromNumber(8983) }],
      },
    });

    // LDAP for DCM4CHEE
    new KubeDeployment(this, "ldap", {
      metadata: {
        name: "ldap",
        namespace: "shanoir-ng",
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: "ldap" } },
        template: {
          metadata: { labels: { app: "ldap" } },
          spec: {
            containers: [
              {
                name: "ldap",
                image: "dcm4che/slapd-dcm4chee:2.6.2-27.0",
                ports: [{ containerPort: 389 }],
                volumeMounts: [
                  {
                    name: "dcm4chee-ldap-data",
                    mountPath: "/var/lib/openldap/openldap-data",
                  },
                  {
                    name: "dcm4chee-sldap-data",
                    mountPath: "/etc/openldap/slapd.d",
                  },
                ],
              },
            ],
            volumes: [
              {
                name: "dcm4chee-ldap-data",
                persistentVolumeClaim: { claimName: "dcm4chee-ldap-data-pvc" },
              },
              {
                name: "dcm4chee-sldap-data",
                persistentVolumeClaim: { claimName: "dcm4chee-sldap-data-pvc" },
              },
            ],
          },
        },
      },
    });

    new KubeService(this, "ldap-service", {
      metadata: {
        name: "ldap",
        namespace: "shanoir-ng",
      },
      spec: {
        selector: { app: "ldap" },
        ports: [{ port: 389, targetPort: IntOrString.fromNumber(389) }],
      },
    });

    // DCM4CHEE Database
    new KubeDeployment(this, "dcm4chee-database", {
      metadata: {
        name: "dcm4chee-database",
        namespace: "shanoir-ng",
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: "dcm4chee-database" } },
        template: {
          metadata: { labels: { app: "dcm4chee-database" } },
          spec: {
            containers: [
              {
                name: "dcm4chee-database",
                image: "dcm4che/postgres-dcm4chee:14.4-27",
                ports: [{ containerPort: 5432 }],
                env: [
                  {
                    name: "POSTGRES_PASSWORD",
                    value: "dcm4chee",
                  },
                  {
                    name: "POSTGRES_INITDB_ARGS",
                    value: "--no-sync",
                  },
                  {
                    name: "PGDATA",
                    value: "/var/lib/postgresql/data/pgdata",
                  },
                ],
                volumeMounts: [
                  {
                    name: "dcm4chee-database-data",
                    mountPath: "/var/lib/postgresql/data",
                  },
                ],
              },
            ],
            volumes: [
              {
                name: "dcm4chee-database-data",
                persistentVolumeClaim: {
                  claimName: "dcm4chee-database-data-pvc",
                },
              },
            ],
          },
        },
      },
    });

    new KubeService(this, "dcm4chee-database-service", {
      metadata: {
        name: "dcm4chee-database",
        namespace: "shanoir-ng",
      },
      spec: {
        selector: { app: "dcm4chee-database" },
        ports: [{ port: 5432, targetPort: IntOrString.fromNumber(5432) }],
      },
    });

    // DCM4CHEE Arc
    new KubeDeployment(this, "dcm4chee-arc", {
      metadata: {
        name: "dcm4chee-arc",
        namespace: "shanoir-ng",
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: "dcm4chee-arc" } },
        template: {
          metadata: { labels: { app: "dcm4chee-arc" } },
          spec: {
            containers: [
              {
                name: "dcm4chee-arc",
                image: "dcm4che/dcm4chee-arc-psql:5.27.0",
                env: [
                  { name: "POSTGRES_HOST", value: "dcm4chee-database" },
                  { name: "WILDFLY_CHOWN", value: "/storage" },
                  {
                    name: "WILDFLY_WAIT_FOR",
                    value: "ldap:389 dcm4chee-database:5432",
                  },
                ],
                ports: [
                  { containerPort: 8081 },
                  { containerPort: 8443 },
                  { containerPort: 9990 },
                  { containerPort: 11112 },
                  { containerPort: 2575 },
                ],
                volumeMounts: [
                  {
                    name: "dcm4chee-arc-wildfly-data",
                    mountPath: "/opt/wildfly/standalone",
                  },
                  { name: "dcm4chee-arc-storage-data", mountPath: "/storage" },
                ],
              },
            ],
            volumes: [
              {
                name: "dcm4chee-arc-wildfly-data",
                persistentVolumeClaim: {
                  claimName: "dcm4chee-arc-wildfly-data-pvc",
                },
              },
              {
                name: "dcm4chee-arc-storage-data",
                persistentVolumeClaim: {
                  claimName: "dcm4chee-arc-storage-data-pvc",
                },
              },
            ],
          },
        },
      },
    });

    new KubeService(this, "dcm4chee-arc-service", {
      metadata: {
        name: "dcm4chee-arc",
        namespace: "shanoir-ng",
      },
      spec: {
        selector: { app: "dcm4chee-arc" },
        ports: [
          {
            name: "http",
            port: 8081,
            targetPort: IntOrString.fromNumber(8081),
          },
          {
            name: "https",
            port: 8443,
            targetPort: IntOrString.fromNumber(8443),
          },
          {
            name: "management",
            port: 9990,
            targetPort: IntOrString.fromNumber(9990),
          },
          {
            name: "dicom",
            port: 11112,
            targetPort: IntOrString.fromNumber(11112),
          },
          { name: "jms", port: 2575, targetPort: IntOrString.fromNumber(2575) },
        ],
      },
    });

    // Nginx
    new KubeDeployment(this, "nginx", {
      metadata: {
        name: "nginx",
        namespace: "shanoir-ng",
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: "nginx" } },
        template: {
          metadata: { labels: { app: "nginx", project: "shanoir-dev" } },
          spec: {
            affinity: {
              podAffinity: {
                preferredDuringSchedulingIgnoredDuringExecution: [
                  {
                    weight: 100,
                    podAffinityTerm: {
                      labelSelector: {
                        matchExpressions: [
                          {
                            key: "project",
                            operator: "In",
                            values: ["shanoir-dev"],
                          },
                        ],
                      },
                      topologyKey: "kubernetes.io/hostname",
                    },
                  },
                ],
              },
            },
            containers: [
              {
                name: "nginx",
                image: "ghcr.io/fli-iam/shanoir-ng/nginx:NG_v2.7.5",
                env: [
                  {
                    name: "SHANOIR_PREFIX",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_PREFIX",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_URL_SCHEME",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_URL_SCHEME",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_URL_HOST",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_URL_HOST",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_X_FORWARDED",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_X_FORWARDED",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_INSTANCE_NAME",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_INSTANCE_NAME",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_INSTANCE_COLOR",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_INSTANCE_COLOR",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_VIEWER_OHIF_URL_HOST",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_VIEWER_OHIF_URL_HOST",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_VIEWER_OHIF_URL_SCHEME",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_VIEWER_OHIF_URL_SCHEME",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_CERTIFICATE_PEM_CRT",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_CERTIFICATE_PEM_CRT",
                      },
                    },
                  },
                  {
                    name: "SHANOIR_CERTIFICATE_PEM_KEY",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "SHANOIR_CERTIFICATE_PEM_KEY",
                      },
                    },
                  },
                  {
                    name: "VIP_URL_HOST",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "VIP_URL_HOST",
                      },
                    },
                  },
                  {
                    name: "VIP_URL_SCHEME",
                    valueFrom: {
                      configMapKeyRef: {
                        name: "shanoir-config",
                        key: "VIP_URL_SCHEME",
                      },
                    },
                  },
                ],
                ports: [{ containerPort: 80 }],
                volumeMounts: [
                  { name: "logs", mountPath: "/var/log/nginx" },
                  {
                    name: "certificate-share-data",
                    mountPath: "/opt/ssl",
                    readOnly: true,
                  },
                ],
              },
            ],
            volumes: [
              {
                name: "logs",
                persistentVolumeClaim: { claimName: "logs-pvc" },
              },
              {
                name: "certificate-share-data",
                persistentVolumeClaim: {
                  claimName: "certificate-share-data-pvc",
                },
              },
            ],
          },
        },
      },
    });

    new KubeService(this, "nginx-service", {
      metadata: {
        name: "nginx",
        namespace: "shanoir-ng",
      },
      spec: {
        selector: { app: "nginx" },
        type: "ClusterIP",
        ports: [
          {
            name: "http",
            port: 80,
            targetPort: IntOrString.fromNumber(80),
          },
        ],
      },
    });

    // Create Ingress for external access
    new KubeIngress(this, "shanoir-ingress", {
      metadata: {
        name: "shanoir-ingress",
        namespace: "shanoir-ng",
        annotations: {
          "cert-manager.io/cluster-issuer": "letsencrypt-prod",
          "traefik.ingress.kubernetes.io/router.entrypoints": "websecure",
        },
      },
      spec: {
        ingressClassName: "traefik",
        tls: [
          {
            hosts: ["shanoir-dev.cibm.ch"],
            secretName: "shanoir-tls-cert",
          },
        ],
        rules: [
          {
            host: "shanoir-dev.cibm.ch",
            http: {
              paths: [
                {
                  path: "/",
                  pathType: "Prefix",
                  backend: {
                    service: {
                      name: "nginx",
                      port: { number: 80 },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    });
  }
}

const app = new App();
new ShanoirNGChart(app, "shanoir-ng");
app.synth();
