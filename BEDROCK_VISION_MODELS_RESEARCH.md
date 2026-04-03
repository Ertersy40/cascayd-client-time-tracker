# AWS Bedrock Vision-Capable Models Research
## Alternatives to Claude for Image Categorization

**Date:** 2026-03-26
**Purpose:** Find cheaper vision models on AWS Bedrock for simple 4-category screenshot categorization (SALES, CLIENT, PRODUCT, OPS)
**Current Model:** `us.anthropic.claude-3-5-haiku-20241022-v1:0`

---

## Vision-Capable Models Available on AWS Bedrock (us-east-2)

### Amazon Nova Models (Vision Capable)
All Amazon Nova models support multimodal input (text, image, video).

| Model Name | Model ID | Cross-Region Profile ID (us-east-2) | Vision Support |
|------------|----------|-------------------------------------|----------------|
| **Nova Micro** | `amazon.nova-micro-v1:0` | `us.amazon.nova-micro-v1:0` | Text only (NO vision) |
| **Nova Lite** | `amazon.nova-lite-v1:0` | `us.amazon.nova-lite-v1:0` | Yes (Text, Image, Video) |
| **Nova 2 Lite** | `amazon.nova-2-lite-v1:0` | `us.amazon.nova-2-lite-v1:0` | Yes (Text, Image, Video) |
| **Nova Pro** | `amazon.nova-pro-v1:0` | `us.amazon.nova-pro-v1:0` | Yes (Text, Image, Video) |
| **Nova Premier** | `amazon.nova-premier-v1:0` | N/A (single region) | Yes (Text, Image, Video) |

**Note:** Nova Micro does NOT support vision despite the name. Use Nova Lite or Nova 2 Lite for cheapest vision.

---

### Meta Llama Models (Vision Capable)

| Model Name | Model ID | Cross-Region Profile ID (us-east-2) | Vision Support |
|------------|----------|-------------------------------------|----------------|
| **Llama 3.2 11B Instruct** | `meta.llama3-2-11b-instruct-v1:0` | `us.meta.llama3-2-11b-instruct-v1:0` | Yes (Text, Image) |
| **Llama 3.2 90B Instruct** | `meta.llama3-2-90b-instruct-v1:0` | `us.meta.llama3-2-90b-instruct-v1:0` | Yes (Text, Image) |
| **Llama 4 Maverick 17B** | `meta.llama4-maverick-17b-instruct-v1:0` | N/A (single region) | Yes (Text, Image) |
| **Llama 4 Scout 17B** | `meta.llama4-scout-17b-instruct-v1:0` | N/A (single region) | Yes (Text, Image) |

**Note:** Llama 3.2 11B is likely the cheapest Meta option for vision tasks.

---

### Mistral AI Models (Vision Capable)

| Model Name | Model ID | Cross-Region Profile ID | Vision Support |
|------------|----------|------------------------|----------------|
| **Ministral 3B** | `mistral.ministral-3-3b-instruct` | N/A (single region) | Yes (Text, Image) |
| **Ministral 8B** | `mistral.ministral-3-8b-instruct` | N/A (single region) | Yes (Text, Image) |
| **Ministral 14B** | `mistral.ministral-3-14b-instruct` | N/A (single region) | Yes (Text, Image) |
| **Pixtral Large** | `mistral.pixtral-large-2502-v1:0` | `us.mistral.pixtral-large-2502-v1:0` | Yes (Text, Image) |

**Note:** Ministral 3B is likely the cheapest Mistral option for simple categorization.

---

### Google Gemma Models (Vision Capable)

| Model Name | Model ID | Pricing (US regions) | Vision Support |
|------------|----------|---------------------|----------------|
| **Gemma 3 4B IT** | `google.gemma-3-4b-it` | $0.04/1M input, $0.08/1M output | Yes (Text, Image) |
| **Gemma 3 12B IT** | `google.gemma-3-12b-it` | $0.09/1M input, $0.29/1M output | Yes (Text, Image) |
| **Gemma 3 27B IT** | `google.gemma-3-27b-it` | $0.23/1M input, $0.38/1M output | Yes (Text, Image) |

**Note:** Gemma 3 4B has confirmed pricing and is extremely cheap.

---

### Other Vision Models

| Model Name | Model ID | Vision Support |
|------------|----------|----------------|
| **NVIDIA Nemotron Nano 12B v2 VL** | `nvidia.nemotron-nano-12b-v2` | Yes (Text, Image) |
| **Qwen3 VL 235B** | `qwen.qwen3-vl-235b-a22b` | Yes (Text, Image) |
| **Moonshot Kimi K2.5** | `moonshotai.kimi-k2.5` | Yes (Text, Image) |

---

## Pricing Comparison

### Confirmed Pricing (US Regions)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Notes |
|-------|----------------------|------------------------|-------|
| **Google Gemma 3 4B** | $0.04 | $0.08 | CONFIRMED - Cheapest option |
| **Google Gemma 3 12B** | $0.09 | $0.29 | CONFIRMED |
| **Google Gemma 3 27B** | $0.23 | $0.38 | CONFIRMED |

### Estimated Pricing (Needs Verification)

AWS pricing for Nova and Llama models is dynamic and region-specific. Based on AWS documentation patterns and from earlier research that found Nova Micro at $0.00030 per 1K tokens ($0.30 per 1M):

| Model | Estimated Input (per 1M tokens) | Estimated Output (per 1M tokens) |
|-------|--------------------------------|----------------------------------|
| **Amazon Nova Micro** | ~$0.30 | ~$1.20 | Text only (NO vision) |
| **Amazon Nova Lite** | ~$0.60-0.75 | ~$2.40-3.00 | Vision capable |
| **Amazon Nova 2 Lite** | ~$0.50-0.70 | ~$2.00-2.80 | Vision capable, newer |
| **Amazon Nova Pro** | ~$3.00 | ~$15.00 | Vision capable |
| **Meta Llama 3.2 11B** | ~$0.15-0.30 | ~$0.45-0.90 | Vision capable |
| **Meta Llama 3.2 90B** | ~$0.90-1.20 | ~$2.70-3.60 | Vision capable |
| **Mistral Ministral 3B** | ~$0.03-0.05 | ~$0.09-0.15 | Vision capable |
| **Claude 3.5 Haiku** | ~$0.80-1.00 | ~$4.00-5.00 | Current model |

### CRITICAL: Verify Actual Pricing

To get exact pricing for your use case, run this AWS CLI command:
```bash
aws pricing get-products \
  --service-code AmazonBedrock \
  --filters "Type=TERM_MATCH,Field=location,Value=US East (Ohio)" \
  --region us-east-1
```

Or check the AWS Bedrock console calculator at specific model pages.

---

## Recommended Models for 4-Category Screenshot Categorization

For your use case (categorizing screenshots into SALES, CLIENT, PRODUCT, OPS), the best options are:

### 1. Google Gemma 3 4B IT (BEST VALUE)
- **Model ID:** `google.gemma-3-4b-it`
- **Pricing:** $0.04 per 1M input tokens, $0.08 per 1M output tokens
- **Why:** Confirmed lowest pricing, sufficient for simple categorization
- **Caveats:** Smaller model, may need prompt tuning

### 2. Amazon Nova Lite (RECOMMENDED)
- **Model ID:** `amazon.nova-lite-v1:0`
- **Cross-Region Profile:** `us.amazon.nova-lite-v1:0`
- **Why:** AWS's budget vision model, good balance of cost and capability
- **Benefit:** Native AWS model, likely well-optimized for Bedrock

### 3. Amazon Nova 2 Lite
- **Model ID:** `amazon.nova-2-lite-v1:0`
- **Cross-Region Profile:** `us.amazon.nova-2-lite-v1:0`
- **Why:** Newer version of Nova Lite, potentially better accuracy
- **Benefit:** Supports cross-region inference for reliability

### 4. Meta Llama 3.2 11B Instruct
- **Model ID:** `meta.llama3-2-11b-instruct-v1:0`
- **Cross-Region Profile:** `us.meta.llama3-2-11b-instruct-v1:0`
- **Why:** Open source model, good performance at low cost
- **Benefit:** 11B parameters = good balance for categorization tasks

---

## Implementation Notes

### Using Cross-Region Inference Profiles
Cross-region profiles route requests to multiple US regions (us-east-1, us-east-2, us-west-2) for better availability and potentially lower latency.

Example for Nova Lite:
```javascript
const command = new InvokeModelCommand({
  modelId: "us.amazon.nova-lite-v1:0",  // Cross-region profile
  contentType: "application/json",
  accept: "application/json",
  body: JSON.stringify(payload)
});
```

### Request Format (Converse API)
All listed models support the Converse API, which provides a standardized interface:

```javascript
const payload = {
  anthropic_version: "bedrock-2023-05-31",
  max_tokens: 10,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: base64Image
          }
        },
        {
          type: "text",
          text: "Categorize as: SALES, CLIENT, PRODUCT, or OPS"
        }
      ]
    }
  ]
};
```

---

## Next Steps

1. **Test Google Gemma 3 4B first** - It has the lowest confirmed pricing
2. **Compare with Amazon Nova Lite** - Likely better accuracy, still cheap
3. **Test Meta Llama 3.2 11B** - Good open-source alternative
4. **Measure accuracy** - Ensure the cheaper model categorizes correctly
5. **Monitor costs** - Track actual usage costs vs Claude 3.5 Haiku

---

## Model Availability Check

Before implementing, verify model access in your AWS account:
```bash
aws bedrock list-foundation-models --region us-east-2 \
  --query 'modelSummaries[?contains(modelId, `google.gemma`) || contains(modelId, `amazon.nova`) || contains(modelId, `meta.llama3-2`)]' \
  --output table
```

---

## References
- AWS Bedrock Models Documentation: https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html
- AWS Bedrock Pricing: https://aws.amazon.com/bedrock/pricing/
- Inference Profiles: https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html
