# Adaptabuddy on AWS ECS Fargate

Container-first deployment with an Application Load Balancer (ALB), TLS via ACM, and secrets in AWS Secrets Manager or SSM Parameter Store.

## Prerequisites
- AWS CLI configured; an ECR repository (e.g., `adaptabuddy`).
- Domain in Route 53 (or external) with an ACM certificate in the target region.
- VPC with public subnets (for ALB) and private subnets with NAT (for Fargate tasks).
- Supabase project with hosted credentials.

## TLDR
- push to main → Actions green
- ECR shows latest + SHA
- run task → logs show “Ready”
- stop task when done

## 1) Build and push the image to ECR
```bash
# Local smoke test
docker compose up --build

# Auth and push to ECR
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker build -t adaptabuddy:latest .
docker tag adaptabuddy:latest <account>.dkr.ecr.<region>.amazonaws.com/adaptabuddy:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/adaptabuddy:latest
```

## 2) Store configuration and secrets
Use Secrets Manager for sensitive values and SSM Parameter Store (SecureString) for the rest. Map the names directly in the task definition.

- Public-ish config: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (use `https://your-domain`), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- Server-only secrets: `SUPABASE_SERVICE_ROLE_KEY`, optional `DATABASE_URL` (only if you wire direct Postgres access).
- Runtime defaults: `NODE_ENV=production`, `PORT=3000`.

## 3) Task definition (Fargate)
- Launch type: Fargate; CPU/Memory: start with `0.5 vCPU / 1GB` (bump to `1 vCPU / 2GB` if needed).
- Container image: ECR URI above; container port `3000`.
- Command: leave default (`node server.js` from the Dockerfile); user is already non-root (`nextjs`).
- Environment/secrets: reference the SSM/Secrets ARNs created in step 2.
- Health check: path `/api/health`, protocol HTTP, success codes `200`, interval 30s, timeout 5s, healthy threshold 2.
- Logging: awslogs driver to CloudWatch Logs (create a log group like `/ecs/adaptabuddy`).

## 4) Networking and ALB
- Target group: type `ip`, port `3000`, health check `/api/health`.
- ALB: internet-facing in public subnets. Listeners:
  - `:80` HTTP -> Redirect to HTTPS `:443`.
  - `:443` HTTPS with ACM cert -> Forward to the target group.
- Security groups:
  - ALB SG: allow `80/443` from the internet.
  - Task SG: allow `3000` **only** from the ALB SG; egress to Supabase/NAT.
- Place tasks in private subnets; ALB lives in public subnets.
- Optional: attach AWS WAF to the ALB with a managed rule set.

## 5) ECS service
- Service type: Fargate, desired count `2`+ for HA.
- Attach to the ALB target group from step 4.
- Enable service auto scaling (e.g., scale on ALB 5XX or CPU/Memory >70%).
- Set deployment circuit breaker and minimum healthy percent to avoid full downtime.

## 6) Security headers and HTTPS posture
- Apply an ALB response header policy adding:  
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`  
  - `X-Content-Type-Options: nosniff`  
  - `X-Frame-Options: DENY`  
  - `Referrer-Policy: strict-origin-when-cross-origin`  
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Add CSP tuned for Supabase/push assets. Prefer a nonce-based policy with `'strict-dynamic'`: generate a cryptographically secure nonce per request in Next.js Middleware, set a header like `Content-Security-Policy: script-src 'nonce-<nonce>' 'strict-dynamic' 'self'; default-src 'self'; img-src 'self' https: data:; connect-src 'self' https://<your-supabase-host>; style-src 'self' 'unsafe-inline'; ...`, and pass the nonce into Server/Client components and `next/script` via the `nonce` prop so only trusted inline scripts run. For simple deployments without third-party scripts, `script-src 'self'` is acceptable, but for production or external scripts stick to the nonce + `'strict-dynamic'` pattern and explicitly trust any external hosts as needed.

## 7) DNS
- Create a Route 53 A/AAAA alias pointing the domain (and `www` if needed) to the ALB.
- Ensure `NEXT_PUBLIC_SITE_URL` matches the canonical HTTPS domain to keep links/redirects consistent.

## 8) Operations
- Observability: CloudWatch Logs for app output; set CloudWatch alarms on ALB 5XX count and target health. Consider AWS X-Ray if you need tracing.
- Secrets rotation: rotate Supabase keys in Secrets Manager/SSM and trigger a new ECS deployment.
- Deploy updates: build/tag/push a new image, then update the ECS service to the new tag (or wire CI/CD with GitHub Actions -> ECR -> ECS deploy).
