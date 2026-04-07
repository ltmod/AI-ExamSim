const QUESTIONS_DATA = {
  meta: {
    title: "General Cybersecurity (Sample)",
    totalQuestions: 10,
    domains: [
      "Identity and Access",
      "Network and Application Security",
      "Risk and Governance",
      "Security Operations"
    ]
  },
  questions: [
    {
      id: 1,
      domain: "Identity and Access",
      question:
        "Which control is the PRIMARY defense against credential theft when users access corporate email from untrusted networks?",
      options: {
        A: "Requiring multifactor authentication (MFA) for remote access",
        B: "Disabling password expiration policies",
        C: "Allowing shared service accounts for convenience",
        D: "Storing passwords in the browser without a master password"
      },
      correctAnswer: "A",
      justifications: {
        A: "MFA adds a second factor so stolen passwords alone cannot complete sign-in, which directly mitigates credential theft on untrusted networks.",
        B: "Password expiration without MFA does not stop an attacker who already captured a valid password, and modern guidance de-emphasizes rotation as a primary control.",
        C: "Shared accounts weaken accountability and increase blast radius if credentials leak; they are not a defense against theft.",
        D: "Browser password storage without strong protection can increase exposure on shared or compromised devices and does not replace strong authentication."
      }
    },
    {
      id: 2,
      domain: "Network and Application Security",
      question:
        "A web application accepts user input that is echoed into an HTML page without encoding. An attacker submits a script tag that runs in other users' browsers. This is BEST described as:",
      options: {
        A: "A SQL injection attack against the database layer",
        B: "A cross-site scripting (XSS) vulnerability",
        C: "A denial-of-service attack on the network perimeter",
        D: "A man-in-the-middle attack on TLS sessions"
      },
      correctAnswer: "B",
      justifications: {
        A: "SQL injection targets database queries with malicious SQL, not script execution in victims' browsers via reflected or stored page content.",
        B: "When untrusted input is rendered as HTML or script in another user's browser, that is XSS; encoding or context-aware output handling is the standard mitigation.",
        C: "Denial-of-service aims at availability through resource exhaustion or floods, not injecting script into page responses.",
        D: "A man-in-the-middle attack intercepts or alters traffic in transit; XSS exploits application output handling, not transport-layer interception."
      }
    },
    {
      id: 3,
      domain: "Risk and Governance",
      question:
        "In the CIA triad, ensuring that data is not altered by unauthorized parties is the definition of:",
      options: {
        A: "Confidentiality",
        B: "Availability",
        C: "Integrity",
        D: "Non-repudiation"
      },
      correctAnswer: "C",
      justifications: {
        A: "Confidentiality is about preventing unauthorized disclosure, not unauthorized modification.",
        B: "Availability ensures timely and reliable access to systems and data, not protection from tampering.",
        C: "Integrity means data and systems are accurate and complete and are not modified by unauthorized actors.",
        D: "Non-repudiation relates to proving who performed an action; it is related to logging and cryptography but is not the CIA term for anti-tampering."
      }
    },
    {
      id: 4,
      domain: "Security Operations",
      question:
        "During an active incident, which action is MOST important immediately after containing a compromised host to limit further damage?",
      options: {
        A: "Publishing a full public postmortem before analysis is complete",
        B: "Deleting all logs to save storage",
        C: "Reimaging the host without preserving evidence",
        D: "Isolating affected systems from the network while preserving volatile evidence where feasible"
      },
      correctAnswer: "D",
      justifications: {
        A: "Public communication is important but premature disclosure without facts can mislead stakeholders; containment and evidence preservation come first.",
        B: "Deleting logs destroys evidence needed for root cause analysis and may violate policy or legal requirements.",
        C: "Reimaging without preserving evidence can erase artifacts needed to understand scope, persistence, and attribution.",
        D: "Isolation stops lateral movement while preserving memory, disk images, and logs when possible supports investigation and recovery."
      }
    },
    {
      id: 5,
      domain: "Identity and Access",
      question:
        "Which principle requires that users receive only the minimum permissions needed to perform their job?",
      options: {
        A: "Least privilege",
        B: "Defense in depth",
        C: "Separation of duties",
        D: "Fail open"
      },
      correctAnswer: "A",
      justifications: {
        A: "Least privilege limits access rights to the minimum necessary, reducing impact if an account is misused or compromised.",
        B: "Defense in depth uses multiple overlapping controls; it does not specifically define minimum necessary permissions.",
        C: "Separation of duties splits conflicting responsibilities across people; it complements but is not the same as least privilege.",
        D: "Fail open describes system behavior on error (often undesirable for security); it is unrelated to minimum permissions."
      }
    },
    {
      id: 6,
      domain: "Network and Application Security",
      question:
        "TLS is used between a client and server primarily to provide:",
      options: {
        A: "Guaranteed protection against application-layer XSS",
        B: "Confidentiality and integrity for data in transit between endpoints",
        C: "Replacement for host-based antivirus scanning",
        D: "Automatic patching of vulnerable services"
      },
      correctAnswer: "B",
      justifications: {
        A: "TLS does not inspect or sanitize HTML or JavaScript; XSS must be fixed in application design and output encoding.",
        B: "TLS encrypts traffic for confidentiality and uses message authentication to detect tampering, protecting data in transit between the TLS endpoints.",
        C: "Antivirus operates on endpoints or gateways; TLS is a protocol for secure channels, not malware detection.",
        D: "Patching is a separate lifecycle activity; TLS does not update software versions."
      }
    },
    {
      id: 7,
      domain: "Risk and Governance",
      question:
        "A security policy states that critical patches must be applied within 30 days. This is BEST categorized as:",
      options: {
        A: "A technical vulnerability scan finding",
        B: "An incident response playbook step",
        C: "A governance control that sets organizational expectations",
        D: "A cryptographic key rotation schedule"
      },
      correctAnswer: "C",
      justifications: {
        A: "A scan finding identifies weaknesses; a patch timeline policy is management direction, not the scan result itself.",
        B: "Incident response playbooks address active events; patch cadence is preventive maintenance and risk management.",
        C: "Policies express what the organization requires and align with governance; they set expectations for patch management.",
        D: "Key rotation governs cryptographic material lifecycles, not general software patch timelines."
      }
    },
    {
      id: 8,
      domain: "Security Operations",
      question:
        "Security information and event management (SIEM) systems are MOST valuable for:",
      options: {
        A: "Replacing physical access badges",
        B: "Generating marketing email campaigns",
        C: "Storing long-term backups of application source code",
        D: "Correlating logs and alerts to detect suspicious activity"
      },
      correctAnswer: "D",
      justifications: {
        A: "Physical access is managed with badges, readers, and policies; SIEM focuses on digital event data.",
        B: "Marketing tools handle campaigns; SIEM is for security monitoring and compliance use cases.",
        C: "Source code belongs in version control and backup systems designed for code, not primarily in SIEM.",
        D: "SIEM aggregates, parses, and correlates security-relevant events to support detection, investigation, and reporting."
      }
    },
    {
      id: 9,
      domain: "Identity and Access",
      question:
        "Which practice MOST reduces risk when an employee with elevated access leaves the organization?",
      options: {
        A: "Promptly disabling accounts and revoking keys and tokens tied to that identity",
        B: "Waiting until the next quarterly access review",
        C: "Transferring the user's passwords to their manager",
        D: "Keeping the account active for 90 days for knowledge transfer without monitoring"
      },
      correctAnswer: "A",
      justifications: {
        A: "Immediate deprovisioning and revocation closes windows for insider or stolen-credential abuse after departure.",
        B: "Quarterly reviews are too slow for termination events; timely offboarding is the standard control.",
        C: "Sharing passwords violates accountability and best practice; identities should be individual and credentials not reused.",
        D: "Leaving privileged access active without tight monitoring creates prolonged exposure and is poor practice."
      }
    },
    {
      id: 10,
      domain: "Network and Application Security",
      question:
        "A stateful firewall at the network perimeter is PRIMARILY intended to:",
      options: {
        A: "Encrypt all internal email by default",
        B: "Enforce allow/deny rules for connections based on session context and policy",
        C: "Replace the need for application security testing",
        D: "Guarantee endpoint hardening on laptops"
      },
      correctAnswer: "B",
      justifications: {
        A: "Email encryption is typically handled by mail gateways or clients, not by the core function of a stateful firewall.",
        B: "Stateful firewalls track connection state and apply policy to permit or block traffic at a network boundary.",
        C: "Firewalls are one layer; they do not remove the need to test and fix application vulnerabilities.",
        D: "Endpoint configuration is managed with MDM, GPO, or similar; perimeter firewalls do not ensure laptop hardening."
      }
    }
  ]
};
