import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

interface CertificateStackProps extends cdk.StackProps {
  domainName: string;
  hostedZoneId?: string;
}

/**
 * Stack for creating ACM certificate in us-east-1 for CloudFront
 * This must be deployed to us-east-1 regardless of where the main stack is deployed
 */
export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: props.env?.account,
        region: 'us-east-1', // CloudFront requires certificates in us-east-1
      },
    });

    const { domainName, hostedZoneId } = props;

    // If hosted zone ID is provided, use DNS validation, otherwise use email validation
    let certificate: acm.Certificate;

    if (hostedZoneId) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId,
        zoneName: domainName,
      });

      certificate = new acm.Certificate(this, 'Certificate', {
        domainName,
        subjectAlternativeNames: [
          `*.${domainName}`, // Covers stage.smultron.zwc.se, prod.smultron.zwc.se, etc.
          `www.${domainName}`,
        ],
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    } else {
      // Fallback to email validation if no hosted zone
      certificate = new acm.Certificate(this, 'Certificate', {
        domainName,
        subjectAlternativeNames: [
          `*.${domainName}`,
          `www.${domainName}`,
        ],
        validation: acm.CertificateValidation.fromEmail(),
      });
    }

    this.certificate = certificate;

    // Output the certificate ARN so it can be used in other stacks
    new cdk.CfnOutput(this, 'CertificateArn', {
      value: certificate.certificateArn,
      description: 'ACM Certificate ARN in us-east-1 for CloudFront',
      exportName: `${domainName.replace(/\./g, '-')}-certificate-arn`,
    });
  }
}
