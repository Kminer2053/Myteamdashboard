const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');
const MarkdownIt = require('markdown-it');

// Puppeteer Chrome 경로 설정 (Render 서버 환경)
if (process.env.RENDER) {
    process.env.PUPPETEER_CACHE_DIR = '/opt/render/.cache/puppeteer';
    process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'false';
}

class PDFGenerator {
    constructor() {
        this.md = new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true
        });
        this.reportsDir = path.join(__dirname, '../reports');
        
        // 보고서 디렉토리 생성
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    /**
     * 마크다운을 PDF로 변환
     * @param {string} markdown - 마크다운 텍스트
     * @param {string} filename - 파일명 (확장자 제외)
     * @returns {Promise<Object>} PDF 파일 정보
     */
    async convertToPDF(markdown, filename = null) {
        try {
            console.log('📄 PDF 변환 시작...');
            
            // 파일명 생성
            const timestamp = Date.now();
            const pdfFileName = filename 
                ? `${filename}-${timestamp}.pdf`
                : `hot-topic-report-${timestamp}.pdf`;
            const pdfFilePath = path.join(this.reportsDir, pdfFileName);

            // 마크다운을 HTML로 먼저 변환
            const htmlContent = this.convertToHTML(markdown);
            
            // Puppeteer 실행 옵션 (Render 서버 환경 대응)
            const launchOptions = {
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ]
            };
            
            // Render 서버 환경에서 Chrome 경로 설정
            if (process.env.RENDER) {
                // Render 서버에서는 시스템 Chrome 사용 시도
                launchOptions.executablePath = process.env.CHROME_BIN || '/usr/bin/google-chrome-stable';
            }
            
            // HTML을 PDF로 변환
            const pdf = await mdToPdf(
                { content: htmlContent },
                {
                    dest: pdfFilePath,
                    pdf_options: {
                        format: 'A4',
                        margin: {
                            top: '20mm',
                            right: '15mm',
                            bottom: '20mm',
                            left: '15mm'
                        },
                        printBackground: true
                    },
                    body_class: 'markdown-body',
                    marked_options: {
                        headerIds: true,
                        mangle: false
                    },
                    launch_options: launchOptions
                }
            ).catch(error => {
                console.error('md-to-pdf 변환 오류:', error);
                console.error('오류 스택:', error.stack);
                // 더 자세한 오류 정보
                if (error.message) {
                    console.error('오류 메시지:', error.message);
                }
                throw new Error(`PDF 변환 실패: ${error.message || '알 수 없는 오류'}`);
            });

            if (!pdf) {
                throw new Error('PDF 생성 실패: 변환 결과가 없습니다');
            }

            // 파일이 실제로 생성되었는지 확인
            if (!fs.existsSync(pdfFilePath)) {
                throw new Error('PDF 파일이 생성되지 않았습니다');
            }

            console.log(`✅ PDF 변환 완료: ${pdfFilePath}`);

            return {
                success: true,
                filePath: pdfFilePath,
                fileName: pdfFileName,
                fileSize: fs.statSync(pdfFilePath).size,
                url: `/reports/${pdfFileName}`
            };

        } catch (error) {
            console.error('❌ PDF 변환 오류:', error);
            console.error('오류 상세:', error.stack);
            return {
                success: false,
                error: error.message || 'PDF 변환 중 알 수 없는 오류가 발생했습니다'
            };
        }
    }

    /**
     * 마크다운을 HTML로 변환 (미리보기용)
     * @param {string} markdown - 마크다운 텍스트
     * @returns {string} HTML 텍스트
     */
    convertToHTML(markdown) {
        try {
            return this.md.render(markdown);
        } catch (error) {
            console.error('마크다운 HTML 변환 오류:', error);
            return `<div class="error">마크다운 변환 중 오류가 발생했습니다: ${error.message}</div>`;
        }
    }

    /**
     * PDF 파일 삭제
     * @param {string} fileName - 파일명
     * @returns {boolean} 삭제 성공 여부
     */
    deletePDF(fileName) {
        try {
            const filePath = path.join(this.reportsDir, fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
            return false;
        } catch (error) {
            console.error('PDF 파일 삭제 오류:', error);
            return false;
        }
    }

    /**
     * 오래된 PDF 파일 정리 (선택사항)
     * @param {number} daysToKeep - 보관할 일수
     */
    async cleanupOldPDFs(daysToKeep = 30) {
        try {
            const files = fs.readdirSync(this.reportsDir);
            const now = Date.now();
            const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

            let deletedCount = 0;
            files.forEach(file => {
                if (file.endsWith('.pdf')) {
                    const filePath = path.join(this.reportsDir, file);
                    const stats = fs.statSync(filePath);
                    const age = now - stats.mtimeMs;

                    if (age > maxAge) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                }
            });

            console.log(`🧹 오래된 PDF 파일 ${deletedCount}개 삭제 완료`);
            return deletedCount;
        } catch (error) {
            console.error('PDF 파일 정리 오류:', error);
            return 0;
        }
    }
}

module.exports = PDFGenerator;

