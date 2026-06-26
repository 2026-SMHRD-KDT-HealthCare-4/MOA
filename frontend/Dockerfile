# 1단계: 빌드 스테이지
FROM node:19-alpine AS builder

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스코드 복사
COPY . .

# 환경 변수 주입 (빌드 타임에 Expo 번들링 파일 내에 반영됨)
ARG EXPO_PUBLIC_API_BASE_URL
ENV EXPO_PUBLIC_API_BASE_URL=${EXPO_PUBLIC_API_BASE_URL}

# Expo Web 정적 파일 내보내기 (dist/ 폴더 생성)
RUN npx expo export --platform web

# 2단계: 서빙 스테이지 (Nginx)
FROM nginx:alpine

# Single Page Application(SPA) 라우팅을 지원하는 Nginx 설정 주입
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 빌드 산출물을 Nginx 서빙 폴더로 복사
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
